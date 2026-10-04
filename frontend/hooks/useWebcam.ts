"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type WebcamStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "no-device"
  | "error";

export interface UseWebcamOptions {
  width?: number;
  height?: number;
  facingMode?: "user" | "environment";
  onReady?: (videoEl: HTMLVideoElement) => void;
}

export interface UseWebcamReturn {
  status: WebcamStatus;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useWebcam(options: UseWebcamOptions = {}): UseWebcamReturn {
  const {
    width = 640,
    height = 480,
    facingMode = "user",
    onReady,
  } = options;

  const [status, setStatus] = useState<WebcamStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const start = useCallback(async () => {
    // If already active or requesting, avoid duplicate requests
    if (status === "requesting" || status === "active") return;

    // Reset previous error
    setErrorMessage(null);
    setStatus("requesting");

    // Check mediaDevices support
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setStatus("error");
      setErrorMessage(
        "Camera is not supported in this browser. Please use Chrome, Edge, or Firefox."
      );
      return;
    }

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: width },
        height: { ideal: height },
        facingMode,
      },
      audio: false,
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setStatus("active");
      setErrorMessage(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(() => {
              // Ignore play interrupt errors on rapid stop/start
            });
            if (onReady) {
              onReady(videoRef.current);
            }
          }
        };
      }
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      console.error("AI Tutor webcam error:", error);

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setStatus("denied");
        setErrorMessage(
          "Camera access is blocked. Click the lock or camera icon in your browser address bar and select 'Allow'."
        );
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        setStatus("no-device");
        setErrorMessage(
          "No webcam was found. Please connect or enable your camera and try again."
        );
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        setStatus("error");
        setErrorMessage(
          "Camera is busy in another app (like Zoom or Teams). Close that app and try again."
        );
      } else if (error.name === "OverconstrainedError") {
        // Fallback with basic constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          setStream(fallbackStream);
          setStatus("active");
          setErrorMessage(null);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play().catch(() => {});
                if (onReady) onReady(videoRef.current);
              }
            };
          }
          return;
        } catch {
          setStatus("error");
          setErrorMessage(
            "Could not open the camera. Please refresh the page and try again."
          );
        }
      } else {
        setStatus("error");
        setErrorMessage(
          "Could not start the camera. Please check your camera connection and try again."
        );
      }
    }
  }, [facingMode, height, onReady, status, width]);

  // Clean up tracks when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    status,
    stream,
    videoRef,
    errorMessage,
    start,
    stop,
  };
}
