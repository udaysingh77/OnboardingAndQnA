// ==================================================================
// Zod validation middleware.
// Expects a schema shaped like { body?, query?, params? } and attaches
// the parsed result onto the request (req.body, req.query, req.params).
// Throws the ZodError (caught by the central handler -> 422).
// ==================================================================
export function validate(schema) {
  return (req, res, next) => {
    try {
      const shape = schema.shape ?? {};
      if (shape.body) req.body = shape.body.parse(req.body);
      if (shape.query) req.query = shape.query.parse(req.query);
      if (shape.params) req.params = shape.params.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}
