import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

export interface AlertFiltersState {
  dataInicio?: string;
  dataFim?: string;
  canal?: string;
  funcao?: string;
  pessoa?: string;
}

interface AlertFiltersProps {
  filters: AlertFiltersState;
  onFiltersChange: (filters: AlertFiltersState) => void;
  canais?: string[];
  funcoes?: string[];
}

export function AlertFilters({
  filters,
  onFiltersChange,
  canais = [],
  funcoes = [],
}: AlertFiltersProps) {
  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some((v) => v);

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Filtros</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Data Início */}
        <div className="space-y-2">
          <Label htmlFor="dataInicio">Data Início</Label>
          <Input
            id="dataInicio"
            type="date"
            value={filters.dataInicio || ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, dataInicio: e.target.value || undefined })
            }
          />
        </div>

        {/* Data Fim */}
        <div className="space-y-2">
          <Label htmlFor="dataFim">Data Fim</Label>
          <Input
            id="dataFim"
            type="date"
            value={filters.dataFim || ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, dataFim: e.target.value || undefined })
            }
          />
        </div>

        {/* Canal */}
        <div className="space-y-2">
          <Label htmlFor="canal">Canal</Label>
          <Select
            value={filters.canal || "todos"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                canal: value === "todos" ? undefined : value,
              })
            }
          >
            <SelectTrigger id="canal">
              <SelectValue placeholder="Todos os canais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os canais</SelectItem>
              {canais.map((canal) => (
                <SelectItem key={canal} value={canal}>
                  {canal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Função */}
        <div className="space-y-2">
          <Label htmlFor="funcao">Função</Label>
          <Select
            value={filters.funcao || "todas"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                funcao: value === "todas" ? undefined : value,
              })
            }
          >
            <SelectTrigger id="funcao">
              <SelectValue placeholder="Todas as funções" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as funções</SelectItem>
              {funcoes.map((funcao) => (
                <SelectItem key={funcao} value={funcao}>
                  {funcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pessoa */}
        <div className="space-y-2">
          <Label htmlFor="pessoa">Pessoa</Label>
          <Input
            id="pessoa"
            type="text"
            placeholder="Nome da pessoa"
            value={filters.pessoa || ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, pessoa: e.target.value || undefined })
            }
          />
        </div>
      </div>
    </Card>
  );
}
