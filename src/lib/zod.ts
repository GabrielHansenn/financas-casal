// Zod configured with Brazilian Portuguese messages. Import `z` from here (not from "zod")
// so every schema, on the server and the client, reports validation errors in pt-BR.
import { z } from "zod";

z.config(z.locales.ptBR());

export { z };
