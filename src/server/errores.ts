/** Errores de aplicación con mensajes en español y código HTTP asociado. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly codigo: string,
    public readonly detalles?: unknown,
  ) {
    super(message);
  }
}

export class NoAutenticado extends AppError {
  constructor(message = "Debe iniciar sesión.") {
    super(message, 401, "NO_AUTENTICADO");
  }
}

export class Prohibido extends AppError {
  constructor(message = "No tiene permiso para realizar esta acción.") {
    super(message, 403, "PROHIBIDO");
  }
}

export class NoEncontrado extends AppError {
  constructor(message = "El registro solicitado no existe.") {
    super(message, 404, "NO_ENCONTRADO");
  }
}

export class Conflicto extends AppError {
  constructor(message: string, detalles?: unknown) {
    super(message, 409, "CONFLICTO", detalles);
  }
}

export class ErrorValidacion extends AppError {
  constructor(message: string, detalles?: unknown) {
    super(message, 422, "VALIDACION", detalles);
  }
}
