import { useLayoutEffect, useState } from "react";

export const RAQEEM_FLOATING_ELEMENT_ID = "raqeem-floating-presence";

let activeFloatingOwner: symbol | null = null;

export function useRaqeemFloatingSingleton(shouldHide: boolean) {
  const [canRender, setCanRender] = useState(false);

  useLayoutEffect(() => {
    if (shouldHide || typeof document === "undefined") {
      setCanRender(false);
      return;
    }

    const existing = document.getElementById(RAQEEM_FLOATING_ELEMENT_ID);
    if (activeFloatingOwner || existing) {
      setCanRender(false);
      return;
    }

    const owner = Symbol("raqeem-floating-owner");
    activeFloatingOwner = owner;
    setCanRender(true);

    return () => {
      if (activeFloatingOwner === owner) {
        activeFloatingOwner = null;
      }
      setCanRender(false);
    };
  }, [shouldHide]);

  return canRender;
}
