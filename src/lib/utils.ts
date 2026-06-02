import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Aiplace } from "@/storage/ChatSession";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


//날짜별로 그룹화하여 시간을 기준으로 오름차순 정렬
export const getGroupedAndSortedPlaces = (places: Aiplace[]) => {
  // 1. 날짜별로 그룹화
  const grouped = places.reduce((acc, place) => {
    if (!acc[place.date]) {
      acc[place.date] = [];
    }
    acc[place.date].push(place);
    return acc;
  }, {} as Record<string, Aiplace[]>);

  // 2. 날짜 키(문자열)를 기준으로 오름차순 정렬
  const sortedDates = Object.keys(grouped).sort();

  // 3. 각 날짜 내부의 장소들을 시간순으로 정렬
  const result: Record<string, Aiplace[]> = {};
  sortedDates.forEach((date) => {
    result[date] = [...grouped[date]].sort((a, b) => {
      const getStart = (time: string) => parseInt(time.split("-")[0]) || 0;
      return getStart(a.time) - getStart(b.time);
    });
  });

  return { sortedDates, groupedPlaces: result };
};

export const sortPlacesByDateTime = (places: any[]) => {
  return [...places].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const timeA = a.time.split("-")[0].trim();
    const timeB = b.time.split("-")[0].trim();
    return timeA.localeCompare(timeB);
  });
};