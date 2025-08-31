import Image from "next/image";

export default function Logo() {
  return (
    <div className="inline-flex items-center justify-center bg-white p-2 rounded-lg">
      <Image src="/logo.png" alt="Logo" width={160} height={48} priority />
    </div>
  );
}
