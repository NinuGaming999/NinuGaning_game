export default function NameInput({ value, onChange, disabled }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, '').slice(0, 30))}
      disabled={disabled}
      placeholder="e.g., Your_Channel_Name"
      maxLength={30}
      className="w-full max-w-[400px] text-white bg-[#2D2D2D] border-2 border-[#FF2E2E] rounded-lg px-4 py-3 text-base tracking-wide outline-none transition duration-200 focus:shadow-[0_0_20px_rgba(255,46,46,0.6)] disabled:opacity-50"
    />
  );
}
