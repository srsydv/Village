import { PASSPORT_OPTIONS } from "../lib/profileOptions.js";

export function PassportSelect({ value, onChange }) {
  const listed = PASSPORT_OPTIONS.includes(value) ? value : value ? "Other" : "India";
  const custom = listed === "Other" ? (PASSPORT_OPTIONS.includes(value) ? "" : value || "") : "";

  return (
    <>
      <select className="field" value={listed} onChange={(e) => onChange(e.target.value === "Other" ? custom || "Other" : e.target.value)}>
        {PASSPORT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt} passport
          </option>
        ))}
      </select>
      {listed === "Other" && (
        <input
          className="field mt-2"
          placeholder="Passport country"
          value={custom}
          onChange={(e) => onChange(e.target.value || "Other")}
        />
      )}
    </>
  );
}
