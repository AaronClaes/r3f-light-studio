import { useThree } from "@react-three/fiber";

/**
 * Asks for a frame. r3f draws by itself when React writes a prop, so on
 * `frameloop="demand"` anything written straight to three.
 */
export function useRedraw(): () => void {
  return useThree((state) => state.invalidate);
}
