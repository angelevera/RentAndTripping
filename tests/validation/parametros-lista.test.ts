import { describe, expect, it } from "vitest";
import {
  escaparPatronLike,
  hayFiltros,
  leerParametrosLista,
  parametrosAQuery,
} from "@/lib/reservas/parametros-lista";

describe("parámetros de lista", () => {
  it("usa búsqueda vacía y página uno por defecto", () => {
    expect(leerParametrosLista({})).toEqual({ q: "", pagina: 1 });
  });

  it("recorta y limita la búsqueda, tomando el primer valor", () => {
    expect(leerParametrosLista({ q: "  ana  " }).q).toBe("ana");
    expect(leerParametrosLista({ q: "x".repeat(150) }).q).toBe("x".repeat(100));
    expect(leerParametrosLista({ q: ["primero", "segundo"] }).q).toBe("primero");
  });

  it("conserva solo los filtros enum válidos", () => {
    expect(leerParametrosLista({ estado: "con_problema", tipo: "hotel" })).toEqual({
      q: "", estado: "con_problema", tipo: "hotel", pagina: 1,
    });
    expect(leerParametrosLista({ estado: "cancelada", tipo: "crucero" })).toEqual({ q: "", pagina: 1 });
  });

  it("valida y limita la página", () => {
    expect(leerParametrosLista({ pagina: "3" }).pagina).toBe(3);

    for (const pagina of ["0", "-4", "abc"]) expect(leerParametrosLista({ pagina }).pagina).toBe(1);
    expect(leerParametrosLista({ pagina: "999999" }).pagina).toBe(10000);
  });

  it("escapa comodines LIKE y quita asteriscos", () => {
    expect(escaparPatronLike("100%_a\\b*")).toBe("100\\%\\_a\\\\b");
  });

  it("serializa solo parámetros activos", () => {
    expect(parametrosAQuery({ q: "", pagina: 1 })).toBe("");
    expect(parametrosAQuery({ q: "ana", estado: "confirmada", tipo: "hotel", pagina: 2 })).toBe(
      "q=ana&estado=confirmada&tipo=hotel&pagina=2",
    );
  });

  it("detecta filtros sin incluir la página", () => {
    expect(hayFiltros({ q: "", pagina: 2 })).toBe(false);
    expect(hayFiltros({ q: "ana", pagina: 1 })).toBe(true);
  });
});
