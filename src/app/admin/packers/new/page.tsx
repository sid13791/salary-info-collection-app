import { getStores, getOpenCycle } from "@/lib/db";
import { NewPackerForm } from "./NewPackerForm";

export const dynamic = "force-dynamic";

export default async function NewPackerPage() {
  const stores = await getStores();
  const cycle = await getOpenCycle();
  return (
    <NewPackerForm stores={stores} cycleOpen={!!cycle} />
  );
}
