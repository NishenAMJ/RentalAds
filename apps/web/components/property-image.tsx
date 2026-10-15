import Image, { type ImageProps } from "next/image";
import { canOptimise } from "@/lib/image-host";

export type PropertyImageProps = Omit<ImageProps, "src" | "unoptimized"> & { src: string };

/** A property photo that is optimised when its host allows it. Always pass `sizes` so phones do not download desktop-sized files. */
export function PropertyImage({ src, alt, ...props }: PropertyImageProps) {
  return <Image src={src} alt={alt} unoptimized={!canOptimise(src)} {...props} />;
}
