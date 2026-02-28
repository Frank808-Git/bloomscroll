"use client";
import React, { useRef, useEffect, useState } from "react";

interface Charity {
	id: string;
	name: string;
	icon: string;
	description: string;
}

const charities: Charity[] = [
	{
		id: "wwf",
		name: "World Wildlife Fund",
		icon: "🐼",
		description:
			"Conserving nature and reducing threats to the diversity of life on Earth.",
	},
	{
		id: "dwb",
		name: "Doctors Without Borders",
		icon: "⚕️",
		description:
			"Providing impartial medical humanitarian assistance to people who need it most.",
	},
	{
		id: "fa",
		name: "Feeding America",
		icon: "🍲",
		description:
			"Working to end hunger by providing food and supporting food security programs.",
	},
	{
		id: "rc",
		name: "American Red Cross",
		icon: "❤️",
		description:
			"Preventing and alleviating human suffering in the face of emergencies.",
	},
];

const WebcamWindow: React.FC = () => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"video" | "charities">("video");
	const [selectedCharity, setSelectedCharity] = useState<string>("");

	// Load from localStorage
	useEffect(() => {
		const saved = localStorage.getItem("selectedCharity");
		if (saved) setSelectedCharity(saved);
	}, []);

	// Save to localStorage
	useEffect(() => {
		if (selectedCharity) {
			localStorage.setItem("selectedCharity", selectedCharity);
		}
	}, [selectedCharity]);

	// Webcam logic
	useEffect(() => {
		let stream: MediaStream;

		const startVideo = async () => {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ video: true });
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
				}
			} catch (err) {
				setError("Could not access webcam. Please check permissions.");
			}
		};

		if (activeTab === "video") startVideo();

		return () => {
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}
		};
	}, [activeTab]);

	const selected = charities.find((c) => c.id === selectedCharity);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
			<div className="w-full max-w-[720px] bg-white rounded-3xl shadow-2xl p-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-slate-800">
						Charity Camera Portal
					</h1>
					<p className="text-slate-500 mt-2">
						Choose a charity or activate your webcam.
					</p>
				</div>

				{/* Tabs */}
				<div className="flex bg-slate-100 rounded-xl p-1 mb-8">
					<button
						onClick={() => setActiveTab("video")}
						className={`flex-1 py-3 rounded-lg text-sm font-semibold transition ${
							activeTab === "video"
								? "bg-white shadow text-blue-600"
								: "text-slate-500 hover:text-blue-600"
						}`}
					>
						📹 Video
					</button>

					<button
						onClick={() => setActiveTab("charities")}
						className={`flex-1 py-3 rounded-lg text-sm font-semibold transition ${
							activeTab === "charities"
								? "bg-white shadow text-blue-600"
								: "text-slate-500 hover:text-blue-600"
						}`}
					>
						❤️ Charity
					</button>
				</div>

				{/* Content */}
				{activeTab === "video" && (
					<div className="flex flex-col items-center text-center">
						<h2 className="text-2xl font-bold text-slate-800 mb-6">
							Live Camera
						</h2>

						{error && (
							<div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm font-medium">
								{error}
							</div>
						)}

						<div className="relative p-4 bg-slate-900 rounded-2xl shadow-xl">
							<video
								ref={videoRef}
								autoPlay
								playsInline
								muted
								className="w-[450px] max-w-full rounded-xl -scale-x-100"
							/>
						</div>
					</div>
				)}

				{activeTab === "charities" && (
					<div>
						<h2 className="text-2xl font-bold text-slate-800 mb-6">
							Select a Charity
						</h2>

						{/* Dropdown */}
						<div className="relative">
							<select
								value={selectedCharity}
								onChange={(e) => setSelectedCharity(e.target.value)}
								className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
							>
								<option value="">Choose an organization</option>
								{charities.map((charity) => (
									<option key={charity.id} value={charity.id}>
										{charity.icon} {charity.name}
									</option>
								))}
							</select>

							{/* Custom Arrow */}
							<div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
								▼
							</div>
						</div>

						{/* Selected Preview */}
						{selected && (
							<div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-2xl shadow-sm transition">
								<div className="flex items-start">
									<div className="text-3xl mr-4">{selected.icon}</div>
									<div>
										<h3 className="text-lg font-semibold text-blue-800">
											{selected.name}
										</h3>
										<p className="text-sm text-slate-600 mt-2">
											{selected.description}
										</p>
									</div>
								</div>
								<div className="mt-4 text-green-600 text-sm font-medium">
									✓ Selection saved
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default WebcamWindow;
