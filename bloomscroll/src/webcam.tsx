"use client";
import React, { useRef, useEffect, useState } from "react";

// 1. Define the interface for the charity objects
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

// 2. Add React.FC type to the component
const WebcamWindow: React.FC = () => {
	// 3. Type the useRef to specifically expect a video element
	const videoRef = useRef<HTMLVideoElement>(null);

	// 4. Add specific types to the state hooks
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"video" | "charities">("video");
	const [selectedCharity, setSelectedCharity] = useState<string | null>(null);

	useEffect(() => {
		// Function to request and start the webcam stream
		const startVideo = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: true,
				});

				// Connect the stream to the video element
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
				}
			} catch (err) {
				console.error("Error accessing the webcam:", err);
				setError("Could not access the webcam. Please check your permissions.");
			}
		};

		// Only start the video if the video tab is active
		if (activeTab === "video") {
			startVideo();
		}

		// Cleanup: Stop the webcam when the component unmounts or tab changes
		return () => {
			if (videoRef.current && videoRef.current.srcObject) {
				// Cast srcObject to MediaStream to access getTracks() in TypeScript
				const stream = videoRef.current.srcObject as MediaStream;
				const tracks = stream.getTracks();

				tracks.forEach((track) => track.stop());
			}
		};
	}, [activeTab]); // Added activeTab to dependency array so camera stops when switching tabs

	return (
		<div className="max-w-[600px] mx-auto font-sans p-4">
			{/* The Tab Navigation Buttons */}
			<div className="flex border-b-2 border-slate-200 mb-5">
				<button
					onClick={() => setActiveTab("video")}
					className={`px-5 py-3 text-base transition-all duration-200 -mb-[2px] ${
						activeTab === "video"
							? "text-blue-600 border-b-2 border-blue-600 font-bold"
							: "text-slate-500 hover:text-blue-600 font-medium"
					}`}
				>
					Video
				</button>

				<button
					onClick={() => setActiveTab("charities")}
					className={`px-5 py-3 text-base transition-all duration-200 -mb-[2px] ${
						activeTab === "charities"
							? "text-blue-600 border-b-2 border-blue-600 font-bold"
							: "text-slate-500 hover:text-blue-600 font-medium"
					}`}
				>
					Charity Selection
				</button>
			</div>

			{/* The Tab Content (Conditional Rendering) */}
			<div className="p-6 bg-slate-50 rounded-lg shadow-sm border border-slate-100 min-h-[400px]">
				{/* Charity Selection Tab */}
				{activeTab === "charities" && (
					<div className="flex flex-col h-full">
						<h3 className="text-xl font-semibold text-slate-800 mb-2">
							Select a Charity
						</h3>
						<p className="text-slate-600 mb-6">
							Choose an organization to support. Your selection will be saved.
						</p>

						<div className="grid grid-cols-1 gap-3">
							{charities.map((charity) => (
								<div
									key={charity.id}
									onClick={() => setSelectedCharity(charity.id)}
									className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
										selectedCharity === charity.id
											? "border-blue-600 bg-blue-50 shadow-sm"
											: "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
									}`}
								>
									<div className="text-3xl mr-4">{charity.icon}</div>
									<div className="flex-1">
										<h4
											className={`text-lg font-semibold ${
												selectedCharity === charity.id
													? "text-blue-800"
													: "text-slate-800"
											}`}
										>
											{charity.name}
										</h4>
										<p className="text-sm text-slate-600 mt-1">
											{charity.description}
										</p>
									</div>

									{/* Selection Indicator */}
									<div className="ml-4 flex items-center justify-center h-full pt-2">
										<div
											className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
												selectedCharity === charity.id
													? "border-blue-600 bg-blue-600"
													: "border-slate-300"
											}`}
										>
											{selectedCharity === charity.id && (
												<svg
													className="w-4 h-4 text-white"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={3}
														d="M5 13l4 4L19 7"
													/>
												</svg>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Video Tab */}
				{activeTab === "video" && (
					<div className="flex flex-col items-center">
						<h2 className="text-xl font-semibold text-slate-800 mb-4">
							Webcam Feed
						</h2>

						{error && <p className="text-red-500 mb-4 font-medium">{error}</p>}

						<video
							ref={videoRef}
							autoPlay
							playsInline
							muted
							className="w-full max-w-[500px] rounded-xl bg-neutral-900 shadow-md -scale-x-100"
						/>
					</div>
				)}
			</div>
		</div>
	);
};

export default WebcamWindow;
