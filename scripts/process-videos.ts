import { processPendingVideos } from "@/lib/video-processing";

async function main() {
  const results = await processPendingVideos();

  if (results.length === 0) {
    console.log("No pending videos to process.");
    return;
  }

  for (const result of results) {
    if (result.status === "ready") {
      console.log(`Processed ${result.id}`);
      continue;
    }

    console.error(`Failed ${result.id}: ${result.error}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
