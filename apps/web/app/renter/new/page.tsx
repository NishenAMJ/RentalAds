import { RequireSession } from "@/components/require-session";
import { RenterRequestForm } from "@/components/renter-request-form";

export default function NewRentalRequestPage() {
  return <RequireSession><RenterRequestForm /></RequireSession>;
}
