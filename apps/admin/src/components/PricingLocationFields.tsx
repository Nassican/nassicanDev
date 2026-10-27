import type { PricingLocation } from "@nassican/shared";
import type { DivipolaPlace } from "@/lib/divipola";
import { fold } from "@/lib/list-filters";
import { PricingLabel as Label, pricingField as field } from "./PricingFields";

export default function PricingLocationFields({
  value,
  onChange,
  places,
  labels = ["País", "Departamento", "Municipio"],
}: {
  value: PricingLocation;
  onChange: (location: PricingLocation) => void;
  places: DivipolaPlace[];
  labels?: readonly [string, string, string];
}) {
  const colombia = fold(value.country) === "colombia" && places.length > 0;
  const departments = [...new Set(places.map((p) => p.department))];
  const department =
    departments.find((name) => fold(name) === fold(value.department)) ?? value.department;
  const municipalities = places.filter((p) => fold(p.department) === fold(value.department));
  const municipality =
    municipalities.find((p) => fold(p.municipality) === fold(value.municipality))?.municipality ??
    value.municipality;
  return (
    <>
      <Label label={labels[0]}>
        <input
          className={field}
          value={value.country}
          onChange={(e) => onChange({ country: e.target.value, department: "", municipality: "" })}
        />
      </Label>
      <Label label={labels[1]}>
        {colombia ? (
          <select
            className={field}
            value={department}
            onChange={(e) => onChange({ ...value, department: e.target.value, municipality: "" })}
          >
            <option value="">Sin departamento</option>
            {value.department && !departments.includes(department) ? (
              <option value={value.department}>{value.department}</option>
            ) : null}
            {departments.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        ) : (
          <input
            className={field}
            value={value.department}
            onChange={(e) => onChange({ ...value, department: e.target.value, municipality: "" })}
          />
        )}
      </Label>
      <Label label={labels[2]}>
        {colombia ? (
          <select
            className={field}
            value={municipality}
            onChange={(e) => onChange({ ...value, municipality: e.target.value })}
          >
            <option value="">Sin municipio</option>
            {value.municipality && !municipalities.some((p) => p.municipality === municipality) ? (
              <option value={value.municipality}>{value.municipality}</option>
            ) : null}
            {municipalities.map((p) => (
              <option key={p.code} value={p.municipality}>
                {p.municipality} ({p.code})
              </option>
            ))}
          </select>
        ) : (
          <input
            className={field}
            value={value.municipality}
            onChange={(e) => onChange({ ...value, municipality: e.target.value })}
          />
        )}
      </Label>
    </>
  );
}
