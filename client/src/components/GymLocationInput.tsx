import { useId, useMemo, useState } from "react";
import { Home, MapPin, Trees, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export const MAX_GYM_LOCATION_LENGTH = 200;

export function normalizeGymLocation(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_GYM_LOCATION_LENGTH);
}

/** Only suggestions from actual saved sessions: no location API or GPS lookup. */
export function getGymLocationSuggestions(
  locations: readonly (string | null | undefined)[],
  query: string
): string[] {
  const seen = new Set<string>();
  const needle = normalizeGymLocation(query).toLocaleLowerCase();
  return locations
    .reduce<string[]>((result, raw) => {
      if (typeof raw !== "string") return result;
      const location = normalizeGymLocation(raw);
      const key = location.toLocaleLowerCase();
      if (location && !seen.has(key)) {
        seen.add(key);
        if (key.includes(needle)) result.push(location);
      }
      return result;
    }, [])
    .slice(0, 12);
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  locations?: readonly (string | null | undefined)[];
  disabled?: boolean;
  label?: string;
};

export default function GymLocationInput({
  value,
  onChange,
  locations = [],
  disabled = false,
  label = "訓練地點（選填）",
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(
    () => getGymLocationSuggestions(locations, value),
    [locations, value]
  );
  const expanded = open && suggestions.length > 0;
  const choose = (location: string) => {
    onChange(location);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-primary"
        />
        <Input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-options` : undefined}
          aria-activedescendant={
            expanded && activeIndex >= 0
              ? `${id}-option-${activeIndex}`
              : undefined
          }
          aria-describedby={`${id}-help`}
          autoComplete="off"
          maxLength={MAX_GYM_LOCATION_LENGTH}
          disabled={disabled}
          placeholder="搜尋曾用健身室，或輸入名稱／分店"
          className="h-11 pl-9 pr-11"
          value={value}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(-1);
          }}
          onBlur={() => {
            setOpen(false);
            setActiveIndex(-1);
          }}
          onChange={event => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (!suggestions.length) return;
              event.preventDefault();
              setOpen(true);
              setActiveIndex(index =>
                event.key === "ArrowDown"
                  ? (index + 1) % suggestions.length
                  : index <= 0
                    ? suggestions.length - 1
                    : index - 1
              );
            } else if (event.key === "Enter" && expanded && activeIndex >= 0) {
              event.preventDefault();
              choose(suggestions[activeIndex]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
        />
        {value && (
          <button
            type="button"
            disabled={disabled}
            aria-label="清除訓練地點"
            onClick={() => choose("")}
            className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
        {expanded && (
          <ul
            id={`${id}-options`}
            role="listbox"
            aria-label="曾用訓練地點"
            className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {suggestions.map((location, index) => (
              <li
                key={location}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={event => event.preventDefault()}
                onClick={() => choose(location)}
                className={`cursor-pointer rounded-lg px-3 py-3 text-sm ${index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
              >
                {location}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { label: "家中", icon: Home },
          { label: "戶外", icon: Trees },
        ].map(({ label: quickLocation, icon: Icon }) => (
          <button
            key={quickLocation}
            type="button"
            disabled={disabled}
            aria-pressed={value === quickLocation}
            onClick={() => choose(quickLocation)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === quickLocation ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            {quickLocation}
          </button>
        ))}
      </div>
      <p
        id={`${id}-help`}
        className="text-[11px] leading-5 text-muted-foreground"
      >
        只使用你輸入及曾儲存的地點；不讀取
        GPS，也不向外部地圖服務查詢。可留空或自行輸入。
      </p>
    </div>
  );
}
