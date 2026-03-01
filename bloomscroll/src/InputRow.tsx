interface InputRowProps {
  value: string;
  onChange: (val: string) => void;
  onAdd: () => void;
  placeholder?: string;
}

export default function InputRow({ value, onChange, onAdd, placeholder }: InputRowProps) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
        placeholder={placeholder ?? "e.g. twitter.com or https://reddit.com"}
        style={{
          flex: 1,
          background: "#f8fafc",
          border: "1.5px solid #e2e8f0",
          borderRadius: 12,
          padding: "11px 16px",
          fontSize: 13,
          fontFamily: "monospace",
          color: "#334155",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#3b82f6";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#e2e8f0";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button
        onClick={onAdd}
        style={{
          padding: "11px 20px",
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13,
          background: "#3b82f6",
          color: "#fff",
          transition: "background 0.2s, transform 0.1s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#2563eb")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#3b82f6")}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        + Add
      </button>
    </div>
  );
}