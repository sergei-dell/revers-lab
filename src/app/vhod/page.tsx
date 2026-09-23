import { LockForm } from "@/components/LockForm";
import { пароль } from "@/lib/замок";

export const dynamic = "force-dynamic";

export const metadata = { title: "РЕВЕРС — вход" };

export default function СтраницаВхода() {
  return <LockForm парольЗадан={Boolean(пароль())} />;
}
