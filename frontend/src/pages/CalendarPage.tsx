import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { postsApi } from "@/api/posts";
import { Platform } from "@/types";

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#E1306C",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
};

export function CalendarPage() {
  const { data } = useQuery({
    queryKey: ["posts", { limit: 100 }],
    queryFn: () => postsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const events = (data?.data ?? [])
    .filter((p) => p.scheduled_at)
    .flatMap((post) =>
      post.variants.map((v) => ({
        id: v.id,
        title: post.title,
        start: post.scheduled_at!,
        backgroundColor: PLATFORM_COLORS[v.platform] ?? "#6366f1",
        borderColor: "transparent",
        extendedProps: { platform: v.platform, status: post.status },
      }))
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="text-muted-foreground text-sm mt-1">Vista mensual de publicaciones programadas</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 [&_.fc]:text-foreground [&_.fc-toolbar-title]:font-semibold [&_.fc-toolbar-title]:text-lg [&_.fc-button]:bg-accent [&_.fc-button]:border-border [&_.fc-button]:text-foreground [&_.fc-button:hover]:bg-accent/80 [&_.fc-button-primary]:!bg-primary [&_.fc-button-primary]:!border-primary [&_.fc-day-today]:!bg-primary/5 [&_.fc-daygrid-day]:!border-border [&_.fc-scrollgrid]:!border-border [&_.fc-col-header-cell]:border-border [&_.fc-scrollgrid-section>td]:border-border">
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={events}
          locale="es"
          height="auto"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          buttonText={{ today: "Hoy" }}
          eventDisplay="block"
          eventBorderRadius={4}
        />
      </div>
    </div>
  );
}
