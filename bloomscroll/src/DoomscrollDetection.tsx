import { useEffect, useRef, useState, useCallback } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  FaceLandmarker,
  ObjectDetector,
  type HandLandmarkerResult,
  type FaceLandmarkerResult,
  type ObjectDetectorResult,
} from "@mediapipe/tasks-vision";
import { triggerDonation, CHARITY_NAMES } from "./donate";

// ─── Constants ────────────────────────────────────────────────────────────────

// Number of consecutive frames the combined signal must hold before we treat it
// as "confirmed". At ~30 fps this is ≈ 0.5 s of consistent detection, which
// absorbs single-frame model misses without adding noticeable latency.
const CONFIRM_FRAMES = 15;

// Once confirmed, the user must stay in the doomscrolling pose for this long
// before a donation fires (prevents accidental triggers).
const HOLD_MS = 2_000;

// Minimum gap between consecutive donations.
const COOLDOWN_MS = 30_000;

// MediaPipe hand landmark indices
const FINGER_TIPS = [4, 8, 12, 16, 20]; // thumb → pinky tips
const FINGER_PIPS = [3, 6, 10, 14, 18]; // corresponding proximal joints

// ─── Types ────────────────────────────────────────────────────────────────────

type Point = { x: number; y: number; z: number };

// ─── Detection helpers ────────────────────────────────────────────────────────

function dist3D(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Returns true when a hand is in a phone-holding grip:
 *
 *  1. 3+ of 4 fingers are curled  — tip.y > pip.y (image y increases downward)
 *  2. Thumb is pulled close to the centre of the hand (not splayed open)
 *  3. The hand bounding box is taller than wide (portrait grip orientation)
 */
function isPhoneGrip(hand: Point[]): boolean {
  // 1 — finger curl (skip thumb at index 0)
  let curledCount = 0;
  for (let i = 1; i < FINGER_TIPS.length; i++) {
    if (hand[FINGER_TIPS[i]].y > hand[FINGER_PIPS[i]].y) curledCount++;
  }

  // 2 — thumb pulled toward middle of palm (landmark 9 = middle-finger MCP)
  const thumbClose = dist3D(hand[4], hand[9]) < 0.35;

  // 3 — portrait bounding box
  const xs = hand.map((p) => p.x);
  const ys = hand.map((p) => p.y);
  const bboxW = Math.max(...xs) - Math.min(...xs);
  const bboxH = Math.max(...ys) - Math.min(...ys);
  const portraitGrip = bboxH > bboxW * 0.8;

  return curledCount >= 3 && thumbClose && portraitGrip;
}

/**
 * Extracts head pitch in degrees from a MediaPipe 4×4 column-major
 * facial transformation matrix.
 *
 * Positive = looking down, negative = looking up.
 */
function getPitch(data: Float32Array | number[]): number {
  return Math.atan2(data[6], data[10]) * (180 / Math.PI);
}

/**
 * Fires when the iris sits in the lower 35% of the eye socket — pure downward gaze.
 */
function isGazingDown(face: Point[]): boolean {
  if (face.length < 478) return false;
  const leftRatio = (face[468].y - face[159].y) / (Math.abs(face[145].y - face[159].y) || 0.001);
  const rightRatio = (face[473].y - face[386].y) / (Math.abs(face[374].y - face[386].y) || 0.001);
  return (leftRatio + rightRatio) / 2 > 0.55;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  selectedCharity: string | null;
}

export default function DoomscrollDetection({ selectedCharity }: Props) {
  const videoRef          = useRef<HTMLVideoElement | null>(null);
  const canvasRef         = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const objectDetectorRef = useRef<ObjectDetector | null>(null);

  // Rolling frame counter — increments toward CONFIRM_FRAMES when signal is
  // active, decrements when not. Absorbs brief model misses without resetting
  // the hold timer.
  const confirmCountRef = useRef(0);

  // Time-based hold tracking
  const holdStartRef    = useRef<number | null>(null);
  const lastDonationRef = useRef<number>(-COOLDOWN_MS);

  // Keep a ref to selectedCharity so the draw loop (memoized with [])
  // can always read the latest value without being re-created.
  const selectedCharityRef = useRef<string | null>(selectedCharity);
  useEffect(() => {
    selectedCharityRef.current = selectedCharity;
  }, [selectedCharity]);

  const [status,        setStatus]        = useState("Initialising…");
  const [signals,       setSignals]       = useState({ grip: false, gazeDown: false, phoneObj: false, irisDown: false });
  const [confirmed,     setConfirmed]     = useState(false);
  const [donationCount, setDonationCount] = useState(0);
  const [cooldownSec,   setCooldownSec]   = useState(0);
  const [pitchDeg,      setPitchDeg]      = useState<number | null>(null);
  const [notification,  setNotification]  = useState<string | null>(null);
  const [testLoading,   setTestLoading]   = useState(false);

  const drawLoop = useCallback(
    (
      video:   HTMLVideoElement,
      canvas:  HTMLCanvasElement,
      ctx:     CanvasRenderingContext2D,
      stopped: { current: boolean },
      rafId:   { current: number | null }
    ) => {
      const loop = () => {
        if (stopped.current) return;

        const handLm = handLandmarkerRef.current;
        const faceLm = faceLandmarkerRef.current;
        const objDet = objectDetectorRef.current;

        if (!handLm || !faceLm || !objDet || !video.videoWidth || !video.videoHeight) {
          rafId.current = requestAnimationFrame(loop);
          return;
        }

        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;

        // Each model gets a slightly offset timestamp so MediaPipe never sees
        // the same ms value twice within a model instance.
        const nowMs = performance.now();
        const handResult: HandLandmarkerResult = handLm.detectForVideo(video, nowMs);
        const faceResult: FaceLandmarkerResult = faceLm.detectForVideo(video, nowMs + 1);
        const objResult:  ObjectDetectorResult = objDet.detectForVideo(video, nowMs + 2);

        // ── Signal extraction ─────────────────────────────────────────────────

        const hands    = handResult.landmarks ?? [];
        const faces    = faceResult.faceLandmarks ?? [];
        const matrices = faceResult.facialTransformationMatrixes ?? [];
        const dets     = objResult.detections ?? [];

        const gripDetected = hands.some(isPhoneGrip);

        // Head pitch via transformation matrix
        const pitch    = matrices[0] ? getPitch(matrices[0].data) : null;
        const gazeDown = pitch !== null && pitch > 5;
        setPitchDeg(pitch !== null ? Math.round(pitch) : null);

        // Low threshold (0.25) — phone backs are featureless, used as supporting signal
        const phoneInFrame = dets.length > 0;

        // Iris gaze — fires when iris sits in the lower 35% of the eye socket
        const irisDown = faces.length > 0 && isGazingDown(faces[0]);

        // If a phone is detected but no face is visible, the phone is blocking
        // the face — the user is almost certainly holding it up to doomscroll.
        const faceVisible       = faces.length > 0;
        const phoneBlockingFace = phoneInFrame && !faceVisible;

        // Require any 2 of the 4 signals — no single signal is mandatory.
        const activeSignals = [gripDetected, gazeDown, irisDown, phoneInFrame].filter(Boolean).length;
        const rawDoomscroll = phoneBlockingFace || activeSignals >= 2;

        // Rolling confirmation — slow-decay counter prevents hold timer from
        // resetting on momentary detection gaps.
        if (rawDoomscroll) {
          confirmCountRef.current = Math.min(confirmCountRef.current + 1, CONFIRM_FRAMES);
        } else {
          confirmCountRef.current = Math.max(confirmCountRef.current - 1, 0);
        }

        const isConfirmed = confirmCountRef.current >= CONFIRM_FRAMES;

        setSignals({ grip: gripDetected, gazeDown, phoneObj: phoneInFrame, irisDown });
        setConfirmed(isConfirmed);

        // ── Donation trigger ──────────────────────────────────────────────────

        const now = performance.now();

        if (isConfirmed) {
          if (holdStartRef.current === null) holdStartRef.current = now;

          const sinceLastDonation = now - lastDonationRef.current;
          const remaining = Math.max(0, COOLDOWN_MS - sinceLastDonation);
          setCooldownSec(Math.ceil(remaining / 1000));

          const heldLongEnough = now - holdStartRef.current >= HOLD_MS;
          const cooldownDone   = sinceLastDonation >= COOLDOWN_MS;

          if (heldLongEnough && cooldownDone) {
            lastDonationRef.current = now;
            holdStartRef.current    = null;
            setDonationCount((c) => c + 1);

            // Frontend-only Stripe simulation (reads latest charity via ref)
            triggerDonation(selectedCharityRef.current ?? "rc")
              .then((result) => {
                if (result.success) {
                  setNotification(result.message);
                  setTimeout(() => setNotification(null), 4000);
                }
              })
              .catch(console.error);
          }
        } else {
          holdStartRef.current = null;
          setCooldownSec(0);
        }

        // ── Draw ──────────────────────────────────────────────────────────────

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Red overlay when doomscrolling confirmed
        if (isConfirmed) {
          ctx.fillStyle = "rgba(255, 50, 50, 0.18)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Hand landmarks — orange when grip detected, lime otherwise
        for (const hand of hands) {
          ctx.fillStyle = isPhoneGrip(hand) ? "orange" : "lime";
          for (const p of hand) {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Nose dot — red when head pitch down, cyan when level
        for (const face of faces) {
          const nose = face[1];
          if (!nose) continue;
          ctx.strokeStyle = gazeDown ? "red" : "cyan";
          ctx.lineWidth   = 2;
          ctx.beginPath();
          ctx.arc(nose.x * canvas.width, nose.y * canvas.height, 8, 0, Math.PI * 2);
          ctx.stroke();

          // Iris dots — yellow when eyes gazing down, white otherwise
          if (face.length >= 478) {
            ctx.fillStyle = irisDown ? "yellow" : "white";
            for (const idx of [468, 473]) {
              const p = face[idx];
              ctx.beginPath();
              ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // Phone bounding boxes from object detector
        for (const det of dets) {
          const bb = det.boundingBox;
          if (!bb) continue;
          ctx.strokeStyle = "#f97316";
          ctx.lineWidth   = 2;
          ctx.strokeRect(bb.originX, bb.originY, bb.width, bb.height);
          ctx.fillStyle = "#f97316";
          ctx.font      = "12px monospace";
          ctx.fillText(
            `phone ${Math.round((det.categories[0]?.score ?? 0) * 100)}%`,
            bb.originX + 4,
            bb.originY + 16,
          );
        }

        rafId.current = requestAnimationFrame(loop);
      };

      rafId.current = requestAnimationFrame(loop);
    },
    []
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    const stopped = { current: false };
    const rafId   = { current: null as number | null };

    async function init() {
      setStatus("Requesting camera…");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      setStatus("Loading MediaPipe models…");

      const vision = await FilesetResolver.forVisionTasks(
        chrome.runtime.getURL("mediapipe-wasm")
      );

      // All three models load in parallel to minimise startup time
      const [handLandmarker, faceLandmarker, objectDetector] = await Promise.all([
        HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          },
          runningMode: "VIDEO",
          numHands: 2,
        }),
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          },
          runningMode: "VIDEO",
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          numFaces: 1,
        }),
        ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
          },
          runningMode: "VIDEO",
          scoreThreshold: 0.5,
          categoryAllowlist: ["cell phone"],
        }),
      ]);

      handLandmarkerRef.current = handLandmarker;
      faceLandmarkerRef.current = faceLandmarker;
      objectDetectorRef.current = objectDetector;

      setStatus("Running…");

      const canvas = canvasRef.current!;
      const ctx    = canvas.getContext("2d")!;
      drawLoop(video, canvas, ctx, stopped, rafId);
    }

    init().catch((e) => {
      console.error(e);
      const msg =
        e instanceof Error
          ? e.message
          : e instanceof Event
          ? `${e.type} event on ${(e.target as HTMLElement)?.tagName ?? "unknown"}`
          : String(e);
      setStatus(`Error: ${msg}`);
    });

    return () => {
      stopped.current = true;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      stream?.getTracks().forEach((t) => t.stop());
      handLandmarkerRef.current?.close();
      faceLandmarkerRef.current?.close();
      objectDetectorRef.current?.close();
      handLandmarkerRef.current = null;
      faceLandmarkerRef.current = null;
      objectDetectorRef.current = null;
    };
  }, [drawLoop]);

  const charityName = selectedCharity ? (CHARITY_NAMES[selectedCharity] ?? selectedCharity) : null;

  return (
    <div style={{ fontFamily: "monospace", display: "grid", gap: 12, padding: "8px 0" }}>
      {/* Donation toast notification */}
      {notification && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            background: "#22c55e",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            zIndex: 9999,
          }}
        >
          💸 {notification}
        </div>
      )}

      <div style={{ fontSize: 13 }}>
        <b>Status:</b> {status}
      </div>

      {charityName && (
        <div style={{ fontSize: 13, color: "#555" }}>
          Donating to: <b>{charityName}</b>
        </div>
      )}
      {!charityName && (
        <div style={{ fontSize: 12, color: "#f97316" }}>
          No charity selected — defaulting to American Red Cross
        </div>
      )}

      {/* Signal pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Signal label="Phone grip"     active={signals.grip} />
        <Signal label="Looking down"   active={signals.gazeDown} />
        <Signal label="Eyes down"      active={signals.irisDown} />
        <Signal label="Phone detected" active={signals.phoneObj} />
        <Signal label="DOOMSCROLLING"  active={confirmed} highlight />
      </div>

      {/* Live pitch readout */}
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Head pitch: {pitchDeg !== null ? `${pitchDeg}°` : "—"}
        <span style={{ marginLeft: 8, color: "#aaa" }}>(triggers at &gt;5°)</span>
      </div>

      {/* Donation counter + cooldown */}
      <div style={{ fontSize: 14 }}>
        <b>Donations triggered:</b> {donationCount}
        {cooldownSec > 0 && confirmed && (
          <span style={{ color: "#888", marginLeft: 10 }}>cooldown {cooldownSec}s</span>
        )}
      </div>

      {/* Test button */}
      <button
        disabled={testLoading}
        onClick={async () => {
          setTestLoading(true);
          try {
            const result = await triggerDonation(selectedCharityRef.current ?? "rc");
            if (result.success) {
              setDonationCount((c) => c + 1);
              setNotification(result.message);
              setTimeout(() => setNotification(null), 4000);
            }
          } catch (e) {
            setNotification(`Error: ${e instanceof Error ? e.message : String(e)}`);
            setTimeout(() => setNotification(null), 5000);
          } finally {
            setTestLoading(false);
          }
        }}
        style={{
          padding: "8px 16px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          background: testLoading ? "#f3f4f6" : "#fff",
          cursor: testLoading ? "not-allowed" : "pointer",
          fontSize: 13,
          color: "#374151",
        }}
      >
        {testLoading ? "Charging…" : "💳 Test Stripe Donation"}
      </button>

      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <canvas
        ref={canvasRef}
        style={{ width: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }}
      />
    </div>
  );
}

// ─── Signal pill ──────────────────────────────────────────────────────────────

function Signal({
  label,
  active,
  highlight = false,
}: {
  label: string;
  active: boolean;
  highlight?: boolean;
}) {
  return (
    <span
      style={{
        padding: highlight ? "6px 14px" : "4px 12px",
        borderRadius: 6,
        fontSize: highlight ? 14 : 12,
        fontWeight: highlight ? 700 : 400,
        background: active ? (highlight ? "#dc2626" : "#22c55e") : "#e5e7eb",
        color: active ? "#fff" : "#6b7280",
        transition: "background 0.2s",
      }}
    >
      {active ? "✓" : "✗"} {label}
    </span>
  );
}
