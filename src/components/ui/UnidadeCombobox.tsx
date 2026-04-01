import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface Branch {
  id: string;
  name: string;
}

interface UnidadeComboboxProps {
  branches: Branch[];
  /** id da branch selecionada, ou "_sem_unidade" / "todas" */
  value: string;
  onChange: (value: string) => void;
  /** Se true, inclui "Todas as unidades" como primeira opção (para filtros) */
  allowAll?: boolean;
  placeholder?: string;
  className?: string;
}

export function UnidadeCombobox({
  branches,
  value,
  onChange,
  allowAll = false,
  placeholder,
  className,
}: UnidadeComboboxProps) {
  // Converte id → label de exibição
  const idToLabel = (id: string) => {
    if (id === "todas") return "";
    if (id === "_sem_unidade") return "";
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const [inputText, setInputText] = useState(() => idToLabel(value));
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Sincroniza quando o valor externo muda (ex.: reset)
  useEffect(() => {
    setInputText(idToLabel(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(inputText.toLowerCase())
  );

  const defaultPlaceholder = allowAll
    ? "Todas as unidades"
    : placeholder ?? "Selecione a unidade";

  return (
    <div className={`relative ${className ?? ""}`}>
      <Input
        value={inputText}
        placeholder={defaultPlaceholder}
        onChange={(e) => {
          setInputText(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />

      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {/* Opção "Todas" ou "Sem unidade" */}
          {allowAll && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm text-muted-foreground"
              onMouseDown={() => {
                onChange("todas");
                setInputText("");
                setShowSuggestions(false);
              }}
            >
              Todas as unidades
            </button>
          )}
          {!allowAll && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm text-muted-foreground"
              onMouseDown={() => {
                onChange("_sem_unidade");
                setInputText("");
                setShowSuggestions(false);
              }}
            >
              Sem unidade
            </button>
          )}

          {/* Sugestões filtradas */}
          {filtered.length === 0 && inputText && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhuma unidade encontrada
            </div>
          )}
          {filtered.map((b) => (
            <button
              key={b.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm font-medium"
              onMouseDown={() => {
                onChange(b.id);
                setInputText(b.name);
                setShowSuggestions(false);
              }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
