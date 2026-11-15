import { z } from "zod";
import { router, ownerProcedure } from "./_core/trpc";
import {
  gymSearchSchema,
  gymIdSchema,
  gymNumericIdSchema,
  gymSaveLocationSchema,
  gymUpsertEquipmentSchema,
  searchGyms,
  getSavedGyms,
  getGymEquipment,
  saveGymLocation,
  upsertGymEquipment,
  deleteGymEquipment,
  getGymMachineCatalog,
} from "./gymDirectory";

/** Personal-tool ownerProcedure intentionally stays public; every DB operation
 * is scoped server-side to canonical owner 2, never to caller-supplied userId. */
export const gymRouter = router({
  search: ownerProcedure
    .input(gymSearchSchema)
    .query(({ input }) => searchGyms(input)),
  getSaved: ownerProcedure.query(() => getSavedGyms()),
  getEquipment: ownerProcedure
    .input(z.object({ gymId: gymIdSchema }).strict())
    .query(({ input }) => getGymEquipment(input.gymId)),
  saveLocation: ownerProcedure
    .input(gymSaveLocationSchema)
    .mutation(({ input }) => saveGymLocation(input)),
  upsertEquipment: ownerProcedure
    .input(gymUpsertEquipmentSchema)
    .mutation(({ input }) => upsertGymEquipment(input)),
  deleteEquipment: ownerProcedure
    .input(z.object({ id: gymNumericIdSchema }).strict())
    .mutation(({ input }) => deleteGymEquipment(input.id)),
  getMachineCatalog: ownerProcedure.query(() => getGymMachineCatalog()),
});
