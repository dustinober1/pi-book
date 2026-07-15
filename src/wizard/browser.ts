export async function openWizardBrowser(url: string): Promise<void> {
  const { default: open } = await import("open");
  await open(url, { wait: false, newInstance: false });
}
