// The outcome of a tool call: data to return as JSON, or an error message Claude can act on.
export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ToolResult<T> => ({ ok: true, data });
export const fail = (error: string): ToolResult<never> => ({ ok: false, error });
