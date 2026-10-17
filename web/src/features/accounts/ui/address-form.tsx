"use client";

import { resultFields, resultValues } from "@/lib/actions";
import { useActionState, useEffect, useState } from "react";
import { saveAddressAction } from "../actions";
import { Field, FormMessage, inputClass, SubmitButton } from "./form-parts";

export interface AddressDefaults {
  id?: string;
  name: string;
  phone: string; // 01XXXXXXXXX
  division: string;
  district: string;
  upazila: string;
  area: string;
  line1: string;
  isDefault: boolean;
}


/** Loads options from GET /api/locations for the cascading selects. */
function useOptions(key: "divisions" | "districts" | "upazilas", param?: { division?: string; district?: string }) {
  const query = param ? new URLSearchParams(param as Record<string, string>).toString() : "";
  const skip = param !== undefined && !Object.values(param)[0];
  const [loaded, setLoaded] = useState<{ query: string; options: string[] }>({ query: "", options: [] });
  useEffect(() => {
    if (skip) return;
    let live = true;
    fetch(`/api/locations?${query}`)
      .then((r) => r.json())
      .then((data: Record<string, string[]>) => live && setLoaded({ query, options: data[key] ?? [] }));
    return () => {
      live = false;
    };
  }, [key, query, skip]);
  return skip || loaded.query !== query ? [] : loaded.options;
}

function Select({
  label,
  name,
  value,
  options,
  onChange,
  error,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  // Keep the saved value selectable while its options load.
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="font-medium">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        className={inputClass}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        <option value="">Choose…</option>
        {list.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function AddressForm({ defaults }: { defaults: AddressDefaults }) {
  const [state, action] = useActionState(saveAddressAction, undefined);
  const f = resultFields(state);
  const v = { ...defaults, ...resultValues(state) };
  const [division, setDivision] = useState(defaults.division);
  const [district, setDistrict] = useState(defaults.district);
  const [upazila, setUpazila] = useState(defaults.upazila);

  const divisions = useOptions("divisions");
  const districts = useOptions("districts", { division });
  const upazilas = useOptions("upazilas", { district });

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <Field label="Receiver's name" name="name" autoComplete="name" required error={f.name} defaultValue={v.name} />
      <Field
        label="Receiver's mobile number"
        name="phone"
        type="tel"
        inputMode="numeric"
        placeholder="01XXXXXXXXX"
        required
        error={f.phone}
        defaultValue={v.phone}
      />
      <Select
        label="Division"
        name="division"
        value={division}
        options={divisions}
        error={f.division}
        onChange={(d) => {
          setDivision(d);
          setDistrict("");
          setUpazila("");
        }}
      />
      <Select
        label="District"
        name="district"
        value={district}
        options={districts}
        error={f.district}
        disabled={!division}
        onChange={(d) => {
          setDistrict(d);
          setUpazila("");
        }}
      />
      {upazilas.length > 0 ? (
        <Select label="Upazila or thana" name="upazila" value={upazila} options={upazilas} error={f.upazila} disabled={!district} onChange={setUpazila} />
      ) : (
        <Field
          label="Upazila or thana"
          name="upazila"
          required
          value={upazila}
          onChange={(e) => setUpazila(e.target.value)}
          error={f.upazila}
          disabled={!district}
        />
      )}
      <Field label="Area" name="area" required hint="For example: Dhanmondi 27, Agrabad, Zindabazar." error={f.area} defaultValue={v.area} />
      <Field label="Address line" name="line1" required hint="House, road, flat or village." error={f.line1} defaultValue={v.line1} />
      <div className="flex items-center gap-2">
        <input id="isDefault" name="isDefault" type="checkbox" defaultChecked={defaults.isDefault} className="h-5 w-5" />
        <label htmlFor="isDefault">Use as my default address</label>
      </div>
      <SubmitButton className="self-start">{defaults.id ? "Save address" : "Add address"}</SubmitButton>
    </form>
  );
}
