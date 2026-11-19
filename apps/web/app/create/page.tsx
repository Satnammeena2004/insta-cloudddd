"use client";

import AppShell from "@/components/AppShell";
import Composer from "@/components/Composer";

export default function CreatePage() {
  return (
    <AppShell>
      <section className="create-page">
        <div className="page-heading"><div><p className="eyebrow">New post</p><h1>Create</h1></div></div>
        <Composer onCreated={() => undefined} />
      </section>
    </AppShell>
  );
}
