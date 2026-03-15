import RetirementCalculator from "@/components/RetirementCalculator";

export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Retirement Planning Calculator
      </h1>

      <RetirementCalculator />
    </main>
  );
}