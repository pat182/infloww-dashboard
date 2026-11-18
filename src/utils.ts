export const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

export function getLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export function formatChartDate(dateKey: string): string {
    const [year, month, day] = dateKey.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
    });
}