import { auth0 } from "@/lib/auth/auth0";
import { getStoredReport } from "@/lib/supabase/services/storedReportsService";
import { redirect } from "next/navigation";
import { DateRangeProvider } from "../../../components/DateRangeProvider";
import StoredReportDetailClient from "./StoredReportDetailClient";

export const dynamic = "force-dynamic";

export default async function StoredReportDetailPage({ params, request }) {
  try {
    const session = await auth0.getSession(request);

    if (!session?.user) {
      redirect("/auth/login");
    }

    const user = session.user.sub;
    const { reportId } = await params;

    const report = await getStoredReport(user, reportId);

    if (!report) {
      redirect("/my/reports");
    }

    return (
      <DateRangeProvider>
        <StoredReportDetailClient report={report} userName={user} />
      </DateRangeProvider>
    );
  } catch (error) {
    console.error("Error loading stored report:", error);
    redirect("/my/reports");
  }
}

