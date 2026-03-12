import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-8 w-48 bg-slate-200 rounded" />
                    <div className="h-4 w-64 bg-slate-100 rounded" />
                </div>
                <div className="h-10 w-44 bg-slate-100 rounded-lg border" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-4 w-24 bg-slate-100 rounded" />
                            <div className="h-4 w-12 bg-blue-50 rounded" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="h-8 w-16 bg-slate-200 rounded" />
                            <div className="h-3 w-32 bg-slate-100 rounded" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2 space-y-4">
                    <Card className="h-[400px]">
                        <CardHeader>
                            <div className="h-5 w-40 bg-slate-100 rounded" />
                        </CardHeader>
                        <CardContent>
                            <div className="w-full h-full bg-slate-50 rounded" />
                        </CardContent>
                    </Card>
                    <Card className="h-[200px]">
                        <CardHeader>
                            <div className="h-5 w-48 bg-slate-100 rounded" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="h-2 w-full bg-slate-100 rounded-full" />
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-10 w-full bg-slate-50 rounded border" />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-4">
                    <Card className="h-full min-h-[500px]">
                        <CardHeader>
                            <div className="h-5 w-32 bg-slate-100 rounded" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-12 w-full bg-slate-50 rounded border" />
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
