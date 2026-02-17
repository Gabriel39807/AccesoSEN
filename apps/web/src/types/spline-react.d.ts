declare module "@splinetool/react-spline" {
  import type { ComponentType } from "react";

  type Props = {
    scene: string;
    onLoad?: () => void;
  };

  const Spline: ComponentType<Props>;
  export default Spline;
}
