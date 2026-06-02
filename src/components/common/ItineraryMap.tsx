declare const google: any;

import { useState, useEffect, useMemo, useRef } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MapPin, LocateFixed, Footprints, Car, Bus } from "lucide-react";
import { sortPlacesByDateTime } from "@/lib/utils";
import type { Aiplace } from "@/storage/ChatSession";
import type { SaveAiplace } from "@/storage/SaveSession";

export type RouteInfo = {
  from: string;
  to: string;
  distance: string;
  duration: string;
  travelMode: "WALKING" | "DRIVING" | "TRANSIT";
};

interface Props {
  places: Aiplace[] | SaveAiplace[];
  messageId?: string;
  onRouteInfosChange?: (infos: RouteInfo[]) => void;
}

type TravelModeKey = "WALKING" | "DRIVING" | "TRANSIT";

const ItineraryMapSkeleton = ({
  places,
  messageId,
  onRouteInfosChange,
}: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const isLoadedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [apiLoaded, setApiLoaded] = useState(false);
  const savedRouteMessageIds = useRef<Set<string>>(new Set());
  const [myLocation, setMyLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [showMyLocation, setShowMyLocation] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelModeKey>("WALKING");

  const sortedPlaces = useMemo(() => {
    return sortPlacesByDateTime(places || []);
  }, [places]);

  useEffect(() => {
    if (isLoadedRef.current) return;

    isLoadedRef.current = true;

    const loadMap = async () => {
      try {
        if (!(window as any).__googleMapsInitialized) {
          setOptions({
            key: "AIzaSyA-eklIWjCx_b5_RkSUOpClD3-nCLr9uds",
          });

          (window as any).__googleMapsInitialized = true;
        }

        await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
          importLibrary("routes"),
        ]);

        setApiLoaded(true);
      } catch (err) {
        console.error("Maps Load Error:", err);
      }
    };

    loadMap();
  }, []);

  useEffect(() => {
    if (!showMyLocation) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMyLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error("현재 위치 오류:", error);
      },
      {
        //오류 수정:
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [showMyLocation]);

  useEffect(() => {
    if (!apiLoaded) return;
    setIsLoading(false);
  }, [apiLoaded]);

  useEffect(() => {
    const drawMap = async () => {
      if (!mapRef.current || !apiLoaded || sortedPlaces.length === 0) {
        return;
      }

      mapRef.current.innerHTML = "";

      const firstLat = Number(sortedPlaces[0].latitude);
      const firstLng = Number(sortedPlaces[0].longitude);

      if (isNaN(firstLat) || isNaN(firstLng)) {
        return;
      }

      const map = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: {
          lat: firstLat,
          lng: firstLng,
        },
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: false,
        rotateControl: false,
        scaleControl: false,
      });

      const bounds = new google.maps.LatLngBounds();

      const routeColors = [
        "#ef4444",
        "#3b82f6",
        "#22c55e",
        "#f59e0b",
        "#a855f7",
      ];

      const groupedPlaces = sortedPlaces.reduce(
        (acc: Record<string, any[]>, place: any) => {
          const date = place.date || place.planDate || "unknown";

          if (!acc[date]) {
            acc[date] = [];
          }

          acc[date].push(place);

          return acc;
        },
        {}
      );
      const collectedRoutes: RouteInfo[] = [];
      const routePromises: Promise<void>[] = [];
      const routeGroups = Object.values(groupedPlaces).filter(
        (dayPlaces: any[]) => dayPlaces.length >= 2
      );
      const finalRouteGroups =
        routeGroups.length > 0
          ? routeGroups
          : sortedPlaces.length >= 2
            ? [sortedPlaces]
            : [];

      const addRoutePromise = (
        dayPlaces: any[],
        dayIdx: number,
        startIndex: number
      ) => {
        const originPlace = dayPlaces[startIndex];
        const destinationPlace = dayPlaces[startIndex + 1];

        const origin = {
          lat: Number(originPlace.latitude),
          lng: Number(originPlace.longitude),
        };

        const destination = {
          lat: Number(destinationPlace.latitude),
          lng: Number(destinationPlace.longitude),
        };

        if (
          isNaN(origin.lat) ||
          isNaN(origin.lng) ||
          isNaN(destination.lat) ||
          isNaN(destination.lng)
        ) {
          console.error(
            "ROUTE POSITION ERROR:",
            originPlace,
            destinationPlace
          );

          return;
        }

        const promise = new Promise<void>((resolve) => {
          const directionsService =
            new google.maps.DirectionsService();

          const directionsRenderer =
            new google.maps.DirectionsRenderer({
              map,
              suppressMarkers: true,
              preserveViewport: true,
              polylineOptions: {
                strokeColor:
                  routeColors[dayIdx % routeColors.length],
                strokeOpacity: 0.85,
                strokeWeight: 5,
              },
            });

          directionsService.route(
            {
              origin,
              destination,
              travelMode: google.maps.TravelMode[travelMode],
            },
            (result: any, status: any) => {
              if (status === "OK" && result) {
                directionsRenderer.setDirections(result);

                const leg = result.routes?.[0]?.legs?.[0];

                //오류 수정:
                collectedRoutes.push({
                  from: originPlace.title,
                  to: destinationPlace.title,
                  distance: leg?.distance?.text || "",
                  duration: leg?.duration?.text || "",
                  travelMode,
                });
              } else {
                console.error(
                  "Directions Error:",
                  status,
                  originPlace.title,
                  destinationPlace.title
                );

                const fallbackLine = new google.maps.Polyline({
                  path: [origin, destination],
                  geodesic: true,
                  strokeColor:
                    routeColors[dayIdx % routeColors.length],
                  strokeOpacity: 0.5,
                  strokeWeight: 4,
                });

                fallbackLine.setMap(map);

                //오류 수정: Directions 실패해도 화면에 실패 원인이 보이도록 전달
                collectedRoutes.push({
                  from: originPlace.title,
                  to: destinationPlace.title,
                  distance: "계산 실패",
                  duration: "계산 실패",
                  travelMode,
                });
              }

              resolve();
            }
          );
        });

        routePromises.push(promise);
      };

      finalRouteGroups.forEach(
        (dayPlaces: any[], dayIdx: number) => {
          for (let i = 0; i < dayPlaces.length - 1; i++) {
            addRoutePromise(dayPlaces, dayIdx, i);
          }
        }
      );

      await Promise.all(routePromises);

      console.log(
        "ROUTE INFOS SENT:",
        collectedRoutes
      );

      onRouteInfosChange?.(collectedRoutes);

      sortedPlaces.forEach((place, idx) => {
        const lat = Number(place.latitude);
        const lng = Number(place.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
          const position = {
            lat,
            lng,
          };

          new google.maps.Marker({
            position,
            map,
            title: place.title,
            label: String(idx + 1),
          });

          bounds.extend(position);
        }
      });

      if (showMyLocation && myLocation) {
        new google.maps.Marker({
          position: myLocation,
          map,
          title: "현재 위치",
          label: "내",
        });

        bounds.extend(myLocation);
      }

      map.fitBounds(bounds, {
        padding: 50,
      });

      if (!messageId) {
        return;
      }

      //오류 수정:
      if (collectedRoutes.length > 0) {
        console.log("SAVE ROUTES message_id:", messageId);

        //오류 수정: 같은 messageId는 routes 저장을 한 번만 실행
        if (savedRouteMessageIds.current.has(messageId)) {
          return;
        }

        savedRouteMessageIds.current.add(messageId);

        try {
          const res = await fetch(
            "https://ai-web-calendar-supabase.onrender.com/api/save-routes",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message_id: messageId,
                routes: collectedRoutes.map((route) => ({
                  from_place_title: route.from,
                  to_place_title: route.to,
                  travel_mode: route.travelMode,
                  distance: route.distance,
                  duration: route.duration,
                })),
              }),
            }
          );

          const result = await res.json();

          //오류 수정:
          if (!res.ok) {
            console.error("SAVE ROUTES FAILED:", result);
            return;
          }

          console.log("경로 저장 완료");
          onRouteInfosChange?.(collectedRoutes);
        } catch (error) {
          console.error("경로 저장 실패:", error);
        }
      }
    };

    drawMap();
  }, [
    apiLoaded,
    sortedPlaces,
    myLocation,
    showMyLocation,
    travelMode,
    messageId,
    onRouteInfosChange,
  ]);

  return (
    <div className="relative h-full w-full overflow-hidden z-10 rounded-xl border border-slate-200 shadow-lg bg-white">

      <div className="absolute top-14 right-3 z-30 flex gap-2 bg-white/90 backdrop-blur-sm border rounded-xl shadow-lg p-1">
        <button
          type="button"
          onClick={() => setTravelMode("WALKING")}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium ${travelMode === "WALKING"
            ? "bg-black text-white"
            : "hover:bg-gray-100"
            }`}
        >
          <Footprints className="w-4 h-4" />
          도보
        </button>

        <button
          type="button"
          onClick={() => setTravelMode("DRIVING")}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium ${travelMode === "DRIVING"
            ? "bg-black text-white"
            : "hover:bg-gray-100"
            }`}
        >
          <Car className="w-4 h-4" />
          차량
        </button>

        <button
          type="button"
          onClick={() => setTravelMode("TRANSIT")}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium ${travelMode === "TRANSIT"
            ? "bg-black text-white"
            : "hover:bg-gray-100"
            }`}
        >
          <Bus className="w-4 h-4" />
          대중교통
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowMyLocation((prev) => !prev)}
        className="absolute bottom-16 right-4 z-30 flex items-center gap-2 bg-white border shadow-lg rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-100"
      >
        <LocateFixed className="w-4 h-4" />

        {showMyLocation
          ? "현재 위치 숨기기"
          : "현재 위치 표시"}
      </button>

      <div
        ref={mapRef}
        className={`h-full w-full transition-opacity duration-500 ${isLoading ? "opacity-0" : "opacity-100"
          }`}
      />

      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 shadow-inner">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />

          <p className="font-bold text-slate-500 text-sm animate-pulse text-center px-4">
            일정 순서에 맞춰 지도를 구성하고 있습니다...
            🗺️
          </p>
        </div>
      )}

      {!isLoading && sortedPlaces.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
          <MapPin
            size={48}
            className="mb-2 opacity-20"
          />

          <p>
            생성된 여행 일정이 여기에 표시됩니다.
          </p>
        </div>
      )}

      {!isLoading && sortedPlaces.length > 0 && (
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[11px] font-semibold z-10 shadow-md border border-slate-100 text-slate-700 animate-in fade-in duration-300">
          📍 {sortedPlaces.length}개 장소
          ({travelMode === "WALKING"
            ? "도보"
            : travelMode === "DRIVING"
              ? "차량"
              : "대중교통"} 경로 표시)
        </div>
      )}
    </div>
  );
};

export default ItineraryMapSkeleton;