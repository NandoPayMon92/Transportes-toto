"use client";
import { useRouter } from "next/navigation";
import { FormCambioClave } from "@/components/FormCambioClave";
import { Aviso } from "@/components/ui/Estados";

export default function PaginaCambiarClave() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Cambiar contraseña</h1>
      <Aviso tipo="info">Debe definir una contraseña personal antes de continuar.</Aviso>
      <FormCambioClave
        onListo={() => {
          router.replace("/");
          router.refresh();
        }}
      />
    </div>
  );
}
