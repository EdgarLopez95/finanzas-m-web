import { z } from "zod";

export const moneySchema = z.number().finite().min(0);
