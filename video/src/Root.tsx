import React from "react";
import { Composition } from "remotion";
import { HaberVideo, haberSuresi } from "./HaberVideo";
import type { HaberVerisi } from "./tipler";
import ornek from "./ornek_mecca.json";

const FPS = 30;

export const Root: React.FC = () => (
  <Composition
    id="Haber"
    component={HaberVideo}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.ceil(haberSuresi(ornek as HaberVerisi) * FPS)}
    defaultProps={ornek as HaberVerisi}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.ceil(haberSuresi(props) * FPS),
    })}
  />
);
