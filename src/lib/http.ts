export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  // Never log raw SDK/database errors, headers, payloads or credentials.
  console.error("billing_request_failed");
  return Response.json(
    { error: "Le traitement a échoué. Réessayez ou contactez le support." },
    { status: 503 },
  );
}
