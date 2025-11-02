import UsernameFormClient from "./UsernameFormClient";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <UsernameFormClient />
    </main>
  );
}
