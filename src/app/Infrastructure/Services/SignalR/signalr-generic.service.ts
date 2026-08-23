import { Injectable } from '@angular/core';
import * as signalR from "@microsoft/signalr";
import { environment } from 'src/environments/environment';
import { Subject, Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class SignalrGenericService {
  public hubName: string;
  private hubConnection: signalR.HubConnection;
  private hubCallSubjects = new Map<string, Subject<any>>();
  private hubCallHandlers = new Map<string, (response: any) => void>();
  private startPromise: Promise<string> | null = null;
  private startPromiseHubName: string | null = null;
  private readonly debugLoggingEnabled = !environment.production || !!(environment as any).enableDebugLogging;

  constructor() { }

  get getHubConnection(): signalR.HubConnection {
    return this.hubConnection;
  }

  get getHubName(): string {
    return this.hubName;
  }

  /**
   * Check if the connection is established and ready for use
   */
  get isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }

  /**
   * Get the current connection state
   */
  get connectionState(): signalR.HubConnectionState | null {
    return this.hubConnection?.state ?? null;
  }

  private debugLog(message?: any, ...optionalParams: any[]): void {
    if (!this.debugLoggingEnabled) return;
    console.log(message, ...optionalParams);
  }

  public startConnection = (hubName: string): Promise<string> => {
    this.hubName = hubName;

    // Prevent parallel start/build calls that can create duplicate connections.
    if (this.startPromise && this.startPromiseHubName === hubName) {
      return this.startPromise;
    }

    // Fast-path: already connected to the same hub.
    if (
      this.hubConnection &&
      this.hubName === hubName &&
      this.hubConnection.state === signalR.HubConnectionState.Connected
    ) {
      this.attachAllHubCalls();
      return Promise.resolve(this.hubConnection.state);
    }

    // If a connection exists and is in-flight, wait for readiness rather than rebuilding.
    if (
      this.hubConnection &&
      this.hubName === hubName &&
      (this.hubConnection.state === signalR.HubConnectionState.Connecting ||
        this.hubConnection.state === signalR.HubConnectionState.Reconnecting)
    ) {
      const p = this.waitForConnectionReady(5000)
        .then(() => this.hubConnection.state)
        .catch(() => this.hubConnection.state);
      this.startPromise = p;
      this.startPromiseHubName = hubName;
      return p.finally(() => {
        this.startPromise = null;
        this.startPromiseHubName = null;
      });
    }

    // Detect transport support
    const supportsWebSocket = typeof WebSocket !== 'undefined';
    const supportsEventSource = typeof EventSource !== 'undefined';

    let transportTypes = signalR.HttpTransportType.WebSockets;
    if (supportsWebSocket) {
      transportTypes = signalR.HttpTransportType.WebSockets
        | signalR.HttpTransportType.ServerSentEvents
        | signalR.HttpTransportType.LongPolling;
      if (!supportsEventSource) {
        transportTypes = signalR.HttpTransportType.WebSockets
          | signalR.HttpTransportType.LongPolling;
      }
    } else {
      transportTypes = supportsEventSource
        ? signalR.HttpTransportType.ServerSentEvents
        : signalR.HttpTransportType.LongPolling;
    }

    const start = new Promise<string>((resolve, reject) => {
      try {
        // If we have an existing disconnected connection for the same hub, prefer restarting it
        // instead of rebuilding (rebuilding can cause duplicate sockets if not carefully stopped).
        const canRestartExisting =
          this.hubConnection &&
          this.hubName === hubName &&
          this.hubConnection.state === signalR.HubConnectionState.Disconnected;

        if (!canRestartExisting) {
          // Best-effort stop old connection before replacing it.
          try {
            if (this.hubConnection && this.hubConnection.state !== signalR.HubConnectionState.Disconnected) {
              this.hubConnection.stop().catch(() => { });
            }
          } catch { }

          const baseUrl = environment.target.replace(/\/+$/, '');
          const hubPath = hubName.replace(/^\/+/, '');
          this.hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${baseUrl}/${hubPath}`, {
              transport: transportTypes,
              withCredentials: true  // Enable cookies for authentication
            })
            // Default backoff can reach 30s; keep it short to reduce "dead" time.
            .withAutomaticReconnect([0, 1000, 2000, 5000])
            .configureLogging(signalR.LogLevel.Information)
            .build();
        }

        // IMPORTANT: ensure all previously-registered hub callbacks are attached
        // before starting the connection. This prevents missed early messages and
        // also survives connection rebuilds (e.g., fallback to long polling).
        this.attachAllHubCalls();

        // Add connection event handlers for better monitoring
        this.hubConnection.onreconnecting((error) => {
          this.debugLog('SignalR reconnecting...', error);
        });

        this.hubConnection.onreconnected((connectionId) => {
          this.debugLog('SignalR reconnected with connectionId:', connectionId);
          // Re-attach all hub calls after reconnection
          this.attachAllHubCalls();
        });

        this.hubConnection.onclose((error) => {
          this.debugLog('SignalR connection closed:', error);
        });

        this.hubConnection.start()
          .then(() => {
            this.debugLog('SignalR connected via', this.hubConnection.connectionId);
            // In some environments SignalR reports Connected before connectionId is populated.
            // Wait a short moment so callers can safely include connectionId in payloads.
            this.waitForConnectionReady(5000)
              .then(() => resolve(this.hubConnection.state))
              .catch((err) => {
                console.warn('SignalR connected but connection not fully ready:', err);
                // Still resolve: callers may choose to invoke without connectionId.
                resolve(this.hubConnection.state);
              });
          })
          .catch(err => {
            console.error('Initial SignalR connection failed:', err);

            // Fallback: Retry with Long Polling if WebSockets failed
            if (supportsWebSocket) {
              console.warn('Retrying SignalR connection with Long Polling...');
              this.hubConnection = new signalR.HubConnectionBuilder()
                .withUrl(`${environment.target.replace(/\/+$/, '')}/${hubName.replace(/^\/+/, '')}`, {
                  transport: signalR.HttpTransportType.LongPolling,
                  withCredentials: true  // Enable cookies for authentication
                })
                .withAutomaticReconnect([0, 1000, 2000, 5000])
                .configureLogging(signalR.LogLevel.Information)
                .build();

              this.attachAllHubCalls();

              // Add connection event handlers for fallback connection too
              this.hubConnection.onreconnecting((error) => {
                this.debugLog('SignalR (fallback) reconnecting...', error);
              });

              this.hubConnection.onreconnected((connectionId) => {
                this.debugLog('SignalR (fallback) reconnected with connectionId:', connectionId);
                this.attachAllHubCalls();
              });

              this.hubConnection.onclose((error) => {
                this.debugLog('SignalR (fallback) connection closed:', error);
              });

              this.hubConnection.start()
                .then(() => {
                  this.debugLog('Fallback SignalR Long-Polling connected via', this.hubConnection.connectionId);
                  this.waitForConnectionReady(5000)
                    .then(() => resolve(this.hubConnection.state))
                    .catch((err) => {
                      console.warn('SignalR connected (fallback) but connection not fully ready:', err);
                      resolve(this.hubConnection.state);
                    });
                })
                .catch(err => {
                  console.error('SignalR long-polling connection also failed:', err);
                  reject(err);
                });
            } else {
              reject(err);
            }
          });
      } catch (ex) {
        console.error('CATCH in startConnection:', ex);
        reject(ex);
      }
    });

    this.startPromise = start;
    this.startPromiseHubName = hubName;
    return start.finally(() => {
      this.startPromise = null;
      this.startPromiseHubName = null;
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait until the connection is fully ready for invocations.
   * In some cases right after start(), `connectionId` can still be null briefly.
   */
  public async waitForConnectionReady(timeoutMs: number = 5000, pollMs: number = 50): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const conn = this.hubConnection;
      if (conn && conn.state === signalR.HubConnectionState.Connected && !!conn.connectionId) {
        return;
      }
      await this.sleep(pollMs);
    }

    throw new Error(
      `SignalR connection not ready after ${timeoutMs}ms (state=${this.hubConnection?.state}, connectionId=${this.hubConnection?.connectionId})`
    );
  }

  /**
   * Stop the SignalR connection
   */
  public stopConnection = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (this.hubConnection && this.hubConnection.state !== signalR.HubConnectionState.Disconnected) {
          this.hubConnection.stop()
            .then(() => {
              this.debugLog('SignalR connection stopped');
              resolve();
            })
            .catch(err => {
              console.error('Error stopping SignalR connection:', err);
              reject(err);
            });
        } else {
          this.debugLog('SignalR connection already stopped or not initialized');
          resolve();
        }
      } catch (ex) {
        console.error('CATCH in stopConnection:', ex);
        reject(ex);
      }
    });
  }


  public doInvoke(
    invokeName: string,
    arg1?: any,
    arg2?: any,
    arg3?: any,
    arg4?: any,
    arg5?: any
  ): Promise<any> {
    try {
      if (!this.hubConnection) {
        return Promise.reject(new Error('doInvoke: hubConnection is not initialized'));
      }

      // Edge case: Connected but connectionId not yet available.
      if (
        this.hubConnection.state === signalR.HubConnectionState.Connected &&
        !this.hubConnection.connectionId
      ) {
        return this.waitForConnectionReady(5000).then(() =>
          this.doInvoke(invokeName, arg1, arg2, arg3, arg4, arg5)
        );
      }

      // If disconnected, reconnect then retry
      if (
        this.hubConnection?.state === signalR.HubConnectionState.Disconnected ||
        this.hubConnection?.state === signalR.HubConnectionState.Disconnecting
      ) {
        return this.startConnection(this.hubName).then(() =>
          this.doInvoke(invokeName, arg1, arg2, arg3, arg4, arg5)
        );
      }

      // If still connecting/reconnecting, wait briefly and then invoke
      if (
        this.hubConnection?.state === signalR.HubConnectionState.Connecting ||
        this.hubConnection?.state === signalR.HubConnectionState.Reconnecting
      ) {
        return this.waitForConnectionReady(5000).then(() =>
          this.doInvoke(invokeName, arg1, arg2, arg3, arg4, arg5)
        );
      }

      // Otherwise invoke with the correct number of args
      const count = this.countParams(arg1, arg2, arg3, arg4, arg5);
      let invokePromise: Promise<any>;
      switch (count) {
        case 0:
          invokePromise = this.hubConnection!.invoke(invokeName);
          break;
        case 1:
          invokePromise = this.hubConnection!.invoke(invokeName, arg1);
          break;
        case 2:
          invokePromise = this.hubConnection!.invoke(invokeName, arg1, arg2);
          break;
        case 3:
          invokePromise = this.hubConnection!.invoke(invokeName, arg1, arg2, arg3);
          break;
        case 4:
          invokePromise = this.hubConnection!.invoke(invokeName, arg1, arg2, arg3, arg4);
          break;
        case 5:
          invokePromise = this.hubConnection!.invoke(invokeName, arg1, arg2, arg3, arg4, arg5);
          break;
        default:
          return Promise.reject(new Error(`doInvoke: invalid args count ${count}`));
      }

      // First-load race: the underlying transport can close right when we invoke.
      // If we see these errors, reconnect once and retry.
      return invokePromise.catch((err: any) => {
        const msg = (err?.message || err?.toString?.() || '').toString();
        const looksLikeClosed = msg.includes('underlying connection being closed') ||
          msg.includes('Invocation canceled') ||
          msg.includes('connection was closed') ||
          msg.includes('Connection disconnected') ||
          msg.includes('WebSocket is not in the OPEN state');

        if (looksLikeClosed) {
          console.warn(`doInvoke: connection closed during invoke '${invokeName}'; reconnecting and retrying once`, { msg });
          return this.startConnection(this.hubName).then(() =>
            this.doInvoke(invokeName, arg1, arg2, arg3, arg4, arg5)
          );
        }

        console.error(`doInvoke('${invokeName}') failed:`, err);
        return Promise.reject(err);
      });
    } catch (x) {
      console.error("doInvoke error", x, {
        invokeName,
        args: [arg1, arg2, arg3, arg4, arg5],
        state: this.hubConnection?.state,
      });
      return Promise.reject(x);
    }
  }

  public OnHubCall(actionName: string): Observable<any> {
    this.debugLog(actionName);

    const existing = this.hubCallSubjects.get(actionName);
    if (existing) {
      return existing.asObservable();
    }

    const data = new Subject<any>();
    this.hubCallSubjects.set(actionName, data);

    try {
      // Note: it is valid to register handlers before the connection is created/started.
      // We store the subject + handler and attach them when a hubConnection exists.
      this.attachHubCall(actionName);
    } catch (ex) {
      console.error("OnHubCall error", ex);
    }
    return data.asObservable();
  }

  private attachAllHubCalls(): void {
    try {
      if (!this.hubConnection) return;
      for (const actionName of this.hubCallSubjects.keys()) {
        this.attachHubCall(actionName);
      }
    } catch (ex) {
      console.error('attachAllHubCalls error', ex);
    }
  }

  private attachHubCall(actionName: string): void {
    try {
      if (!this.hubConnection) {
        // Will be attached once startConnection builds the hubConnection
        return;
      }

      const subject = this.hubCallSubjects.get(actionName);
      if (!subject) return;

      let handler = this.hubCallHandlers.get(actionName);
      if (!handler) {
        handler = (response: any) => {
          try {
            this.debugLog(`🔔 SignalR RECEIVED '${actionName}':`, response);
            subject.next(response);
          } catch (e) {
            console.error(`SignalR handler error for '${actionName}'`, e);
          }
        };
        this.hubCallHandlers.set(actionName, handler);
        this.debugLog(`📌 SignalR handler REGISTERED for '${actionName}'`);
      }

      // If we rebuilt the connection, ensure we don't double-wire.
      // (On a fresh HubConnection, this is a no-op.)
      try {
        (this.hubConnection as any).off?.(actionName, handler);
      } catch { }

      this.hubConnection.on(actionName, handler);
      this.debugLog(`📡 SignalR handler ATTACHED for '${actionName}' on hub '${this.hubName}'`);
    } catch (ex) {
      console.error(`attachHubCall('${actionName}') error`, ex);
    }
  }

  private countParams(
    arg1?: any,
    arg2?: any,
    arg3?: any,
    arg4?: any,
    arg5?: any
  ): number {
    if (arg5 !== undefined) return 5;
    if (arg4 !== undefined) return 4;
    if (arg3 !== undefined) return 3;
    if (arg2 !== undefined) return 2;
    if (arg1 !== undefined) return 1;
    return 0;
  }


  ngOnDestroy() { }

}
