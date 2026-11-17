import { Suspense } from "react";
import { LoginForm } from "../forms";

export default async function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <Suspense>
      <Notice searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Notice({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const sp = await searchParams;
  const notice = sp.error === "not_admin" ? "This account doesn't have admin access." : undefined;
  return <LoginForm notice={notice} />;
}
