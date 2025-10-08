/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { flatten } from "flat";
import { scheduleJob, type Job } from "node-schedule";
import type { Logger } from "@nhcarrigan/logger";
import type { Events, Client } from "discord.js";

/**
 * A class for logging Discord bot analytics.
 */
export class DiscordAnalytics {
  private job: Job | null = null;

  /**
   * Creates a new instance of the DiscordAnalytics class.
   * @param client -- The Discord client to monitor.
   * @param logger -- Instance of @nhcarrigan/logger to use for logging.
   */
  public constructor(
    private readonly client: Client,
    private readonly logger: Logger,
  ) {
  }

  /**
   * Starts a CRON job to run at midnight (system time) daily.
   * This job will fetch all guilds the bot is in, and log the total number of guilds
   * and members across all guilds. It will also log the approximate number of user installs
   * for the application.
   */
  public startCron(): void {
    if (this.job) {
      return;
    }
    this.job = scheduleJob("metrics", "0 * * * *", async() => {
      try {
        const fakeGuilds = await this.client.guilds.fetch();
        const guilds = await Promise.all(
          fakeGuilds.map(async(guild) => {
            return await guild.fetch();
          }),
        );
        const members = guilds.reduce((accumulator, guild) => {
          return accumulator + guild.memberCount;
        }, 0);
        const userInstalls = await this.client.application?.fetch();
        await this.logger.metric(
          "user_installs",
          userInstalls?.approximateUserInstallCount ?? 0,
          {},
        );
        await this.logger.metric("guilds", guilds.length, {});
        await this.logger.metric("members", members, {});
      } catch (error) {
        await this.logger.error(
          "Discord Analytics CRON Job",
          error instanceof Error
            ? error
            : new Error(String(error)),
        );
      }
    });
  }

  /**
   * Stops the CRON job if it is running.
   */
  public stopCron(): void {
    if (!this.job) {
      return;
    }
    this.job.cancel();
    this.job = null;
  }

  /**
   * Use this to log Discord gateway events. Call this method from your client's event listeners.
   * Pass whatever payload you receive from Discord to attach as metadata. Or pass an empty object
   * if you don't want to log any metadata.
   * @param event - The type of event to log.
   * @param payload - The payload to log.
   */
  public async logGatewayEvent(
    event: Events,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.logger.metric(event, 1, flatten(payload, { delimiter: "_" }));
  }
}
