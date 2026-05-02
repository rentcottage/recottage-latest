import { useState, useEffect, useRef } from 'react';
import { filterCitiesBilingual } from '../../lib/locationNormalizer';

interface AutocompleteOption {
  name: string;
  region: string;
  population?: number;
}

interface AutocompleteInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  required?: boolean;
  className?: string;
}

export default function AutocompleteInput({
  label,
  placeholder,
  value,
  onChange,
  options,
  required = false,
  className = ''
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<AutocompleteOption[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if current value exactly matches a known option
  const isKnownLocation = options.some(
    opt => `${opt.name}, ${opt.region}`.toLowerCase() === value.toLowerCase() ||
           opt.name.toLowerCase() === value.toLowerCase()
  );

  // Show custom fallback option when: has typed text, not an exact known match,
  // and the typed value doesn't already look like it was manually entered
  const showCustomOption = value.trim().length >= 2 && !isKnownLocation;

  // Total "virtual" list length for keyboard nav (filtered + optional custom row)
  const totalItems = filteredOptions.length + (showCustomOption ? 1 : 0);

  useEffect(() => {
    if (value.length >= 1) {
      // Use bilingual filtering so Georgian hosts can type in Georgian
      // and still find the correct city, and vice versa
      const filtered = filterCitiesBilingual(options, value).slice(0, 10);

      setFilteredOptions(filtered);
      setIsOpen(filtered.length > 0 || value.trim().length >= 2);
      setHighlightedIndex(-1);
    } else {
      setFilteredOptions([]);
      setIsOpen(false);
    }
  }, [value, options]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleOptionClick = (option: AutocompleteOption) => {
    onChange(`${option.name}, ${option.region}`);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCustomClick = () => {
    // Keep the typed value as-is — just close the dropdown
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < totalItems - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : totalItems - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleOptionClick(filteredOptions[highlightedIndex]);
        } else if (highlightedIndex === filteredOptions.length && showCustomOption) {
          handleCustomClick();
        } else if (highlightedIndex === -1 && showCustomOption && filteredOptions.length === 0) {
          // If no suggestions at all, Enter confirms the custom text
          handleCustomClick();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }, 150);
  };

  const customRowHighlighted = highlightedIndex === filteredOptions.length && showCustomOption;

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            if (filteredOptions.length > 0 || value.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          required={required}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent pr-10 text-sm"
          autoComplete="off"
        />

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`ri-${isOpen ? 'arrow-up' : 'arrow-down'}-s-line text-gray-400`}></i>
          </div>
        </div>
      </div>

      {isOpen && (filteredOptions.length > 0 || showCustomOption) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg max-h-72 overflow-y-auto"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
        >
          {/* Known location suggestions */}
          {filteredOptions.map((option, index) => (
            <div
              key={`${option.name}-${option.region}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleOptionClick(option)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                index === highlightedIndex
                  ? 'bg-red-50 text-red-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{option.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{option.region}</div>
                </div>
                <div className="w-5 h-5 flex items-center justify-center ml-2 flex-shrink-0">
                  <i className="ri-map-pin-line text-gray-300 text-xs"></i>
                </div>
              </div>
            </div>
          ))}

          {/* Divider before custom option */}
          {filteredOptions.length > 0 && showCustomOption && (
            <div className="border-t border-gray-100 mx-3" />
          )}

          {/* Free-text / custom location fallback */}
          {showCustomOption && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCustomClick}
              className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                customRowHighlighted
                  ? 'bg-red-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
                <i className="ri-edit-line text-gray-500 text-xs"></i>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-800 truncate">
                  Use &ldquo;<span className="text-red-600">{value.trim()}</span>&rdquo;
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Enter as custom location</div>
              </div>
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className="ri-check-line text-gray-300 text-xs"></i>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
