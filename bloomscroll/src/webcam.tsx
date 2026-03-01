import React, { useState, useEffect } from "react";
import DoomscrollDetection from "./DoomscrollDetection";
import BlacklistTab from "./BlacklistTab";
import bloomscrollText from "./assets/bloomscroll_text_nobg.png";

interface Charity {
	id: string;
	name: string;
	icon: string;
	description: string;
}

const charities: Charity[] = [
	{
		id: "rc",
		name: "American Red Cross",
		icon: "❤️",
		description:
			"Preventing and alleviating human suffering in the face of emergencies.",
	},
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
];

const WebcamWindow: React.FC = () => {
	const [activeTab, setActiveTab] = useState<"detection" | "charities" | "blacklist">("detection");
	const [selectedCharity, setSelectedCharity] = useState<string>("rc");

	// Save to localStorage whenever selection changes
	useEffect(() => {
		if (selectedCharity) {
			localStorage.setItem("selectedCharity", selectedCharity);
		}
	}, [selectedCharity]);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-6">
			<div className="w-full max-w-[720px] bg-white rounded-3xl shadow-2xl p-8">
				{/* Header */}
				<div className="mb-8">
					<img src={bloomscrollText} />
					<p className="text-slate-500 mt-2">
						Doomscrolling detected → automatic donation to your chosen charity.
					</p>
				</div>

				{/* Tabs */}
				<div className="flex bg-slate-100 rounded-xl p-1 mb-8">
					<button
						onClick={() => setActiveTab("detection")}
						className={`flex-1 py-3 rounded-lg text-sm font-semibold transition ${
							activeTab === "detection"
								? "bg-white shadow text-blue-600"
								: "text-slate-500 hover:text-blue-600"
						}`}
					>
						🔍 Detection
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

					<button
						onClick={() => setActiveTab("blacklist")}
						className={`flex-1 py-3 rounded-lg text-sm font-semibold transition ${
							activeTab === "blacklist"
								? "bg-white shadow text-blue-600"
								: "text-slate-500 hover:text-blue-600"
						}`}
					>
						🔐 Blacklist
					</button>
				</div>

				{/* Detection Tab */}
				{activeTab === "detection" && (
					<DoomscrollDetection selectedCharity={selectedCharity || null} />
				)}

				{/* Charity Tab */}
				{activeTab === "charities" && (
				<div>
					<h2 className="text-2xl font-bold text-slate-800 mb-6">Select a Charity</h2>

					{(() => {
					const idx = charities.findIndex((c) => c.id === selectedCharity);
					const currentIdx = idx === -1 ? 0 : idx;
					const charity = charities[currentIdx];

					const prev = () => setSelectedCharity(charities[(currentIdx - 1 + charities.length) % charities.length].id);
					const next = () => setSelectedCharity(charities[(currentIdx + 1) % charities.length].id);

					return (
						<>
						{/* Card row */}
						<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
							<button onClick={prev} style={{ fontSize: 28, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: "0 8px" }}>‹</button>

							<div style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							padding: "32px 24px",
							borderRadius: "16px",
							border: `2px solid ${selectedCharity === charity.id ? "#3b82f6" : "#e2e8f0"}`,
							background: selectedCharity === charity.id ? "#eff6ff" : "#fff",
							textAlign: "center",
							boxShadow: selectedCharity === charity.id ? "0 4px 12px rgba(59,130,246,0.15)" : "none",
							transition: "all 0.2s",
							}}>
							<div style={{ fontSize: 56, marginBottom: 16 }}>{charity.icon}</div>
							<div style={{ fontSize: 17, fontWeight: 600, color: "#1e40af", marginBottom: 8 }}>{charity.name}</div>
							<div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 20 }}>{charity.description}</div>
							<button
								onClick={() => setSelectedCharity(charity.id)}
								style={{
								padding: "8px 24px",
								borderRadius: "10px",
								border: "none",
								cursor: selectedCharity === charity.id ? "default" : "pointer",
								fontWeight: 600,
								fontSize: 13,
								background: selectedCharity === charity.id ? "#3b82f6" : "#f1f5f9",
								color: selectedCharity === charity.id ? "#fff" : "#475569",
								transition: "all 0.2s",
								}}
							>
								{selectedCharity === charity.id ? "✓ Selected" : "Select"}
							</button>
							</div>

							<button onClick={next} style={{ fontSize: 28, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: "0 8px" }}>›</button>
						</div>

						{/* Dots */}
						<div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
							{charities.map((c, i) => (
							<button
								key={c.id}
								onClick={() => setSelectedCharity(c.id)}
								style={{
								height: "8px",
								width: i === currentIdx ? "24px" : "8px",
								borderRadius: "4px",
								border: "none",
								cursor: "pointer",
								background: i === currentIdx ? "#3b82f6" : "#cbd5e1",
								transition: "all 0.3s",
								padding: 0,
								}}
							/>
							))}
						</div>
						</>
					);
					})()}
				</div>
				)}

				{activeTab === "blacklist" && (
				<div>
					{activeTab === "blacklist" && <BlacklistTab />}
				</div>
				)}
			</div>
		</div>
	);
};

export default WebcamWindow;
