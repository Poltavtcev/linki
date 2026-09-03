
import React from "react";
import Head from "next/head";
import { useEffect, useState, useCallback } from "react";
import { RiMailSendLine, RiShieldKeyholeLine, RiLinkedinBoxFill, RiTimeLine, RiUserLine } from "react-icons/ri";

const TZ = "Europe/Berlin";

function formatDateTime(ts: string) {
  const d = new Date(ts.endsWith("Z") ? ts : ts + "Z");
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: TZ }) + " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export default function SystemHealth() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/system-health");
      setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <>
      <Head><title>System Health | Linki</title></Head>
      
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">System Health</h1>
          <p className="text-sm text-base-content/60 mt-0.5">Unified dashboard for automated limits and quotas</p>
        </div>
      </div>

      <div className="space-y-10 pb-12">
        {/* LINKEDIN HEALTH */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#0a66c2]/10 flex items-center justify-center text-[#0a66c2]">
              <RiLinkedinBoxFill size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">LinkedIn Quotas</h2>
              <p className="text-xs text-base-content/60">Daily actions jitter by 20% to mimic human behavior .</p>
            </div>
          </div>

          <div className="space-y-6">
            {isLoading && <div className="animate-pulse bg-base-200 h-32 rounded-xl"></div>}
            {data?.linkedin?.map((acc: any) => (
              <div key={acc.id} className="bg-base-200 rounded-xl border border-base-300/50 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-base-300/40">
                  <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-base-content/50">
                    <RiUserLine />
                  </div>
                  <h3 className="font-medium text-base">{acc.name}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* INVITATIONS */}
                  <div className="bg-base-100 rounded-xl p-4 border border-base-300/50 relative overflow-hidden group">
                    <div className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mb-4">Invitations</div>
                    <div className="flex items-end justify-between mb-2">
                      <div className="text-3xl font-light text-base-content">{Math.max(0, acc.invitations.limitToday - acc.invitations.sentToday)}</div>
                      <div className="text-xs text-base-content/40 mb-1">left today</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-base-content/50 mb-1">
                      <span>{acc.invitations.sentToday}</span>
                      <span>{acc.invitations.limitToday}</span>
                    </div>
                    <div className="w-full bg-base-300/50 rounded-full h-1.5">
                      <div className="bg-[#0a66c2] h-1.5 rounded-full" style={{ width: `${Math.min(100, (acc.invitations.sentToday / acc.invitations.limitToday) * 100)}%` }}></div>
                    </div>
                    
                    {/* Weekly tracker */}
                    <div className="mt-4 pt-4 border-t border-base-300/40">
                      <div className="flex items-center justify-between text-[10px] text-base-content/40 mb-1.5">
                        <span>Weekly Quota</span>
                        <span>{acc.invitations.sentWeek} / {acc.invitations.limitWeek}</span>
                      </div>
                      <div className="w-full bg-base-300/30 rounded-full h-1">
                        <div className={`h-1 rounded-full ${acc.invitations.sentWeek >= acc.invitations.limitWeek ? 'bg-warning' : 'bg-base-content/20'}`} style={{ width: `${Math.min(100, (acc.invitations.sentWeek / acc.invitations.limitWeek) * 100)}%` }}></div>
                      </div>
                      {acc.invitations.sentWeek >= acc.invitations.limitWeek && (
                        <div className="mt-2 text-[10px] text-warning/90 font-medium">LinkedIn weekly quota reached. Paused until Monday.</div>
                      )}
                    </div>
                  </div>

                  {/* MESSAGES */}
                  <div className="bg-base-100 rounded-xl p-4 border border-base-300/50">
                    <div className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mb-4">Messages</div>
                    <div className="flex items-end justify-between mb-2">
                      <div className="text-3xl font-light text-base-content">{Math.max(0, acc.messages.limitToday - acc.messages.sentToday)}</div>
                      <div className="text-xs text-base-content/40 mb-1">left today</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-base-content/50 mb-1">
                      <span>{acc.messages.sentToday}</span>
                      <span>{acc.messages.limitToday}</span>
                    </div>
                    <div className="w-full bg-base-300/50 rounded-full h-1.5">
                      <div className="bg-[#0a66c2] h-1.5 rounded-full" style={{ width: `${Math.min(100, (acc.messages.sentToday / acc.messages.limitToday) * 100)}%` }}></div>
                    </div>
                  </div>

                  
                  {/* INMAILS */}
                  <div className="bg-base-100 rounded-xl p-4 border border-base-300/50">
                    <div className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mb-4">InMails</div>
                    <div className="flex items-end justify-between mb-2">
                      <div className="text-3xl font-light text-base-content">{Math.max(0, acc.inmails.limitToday - acc.inmails.sentToday)}</div>
                      <div className="text-xs text-base-content/40 mb-1">left today</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-base-content/50 mb-1">
                      <span>{acc.inmails.sentToday}</span>
                      <span>{acc.inmails.limitToday}</span>
                    </div>
                    <div className="w-full bg-base-300/50 rounded-full h-1.5">
                      <div className="bg-[#0a66c2] h-1.5 rounded-full" style={{ width: `${Math.min(100, (acc.inmails.sentToday / acc.inmails.limitToday) * 100)}%` }}></div>
                    </div>
                  </div>

                  {/* PROFILE VISITS */}
                  <div className="bg-base-100 rounded-xl p-4 border border-base-300/50">
                    <div className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mb-4">Profile Visits</div>
                    <div className="flex items-end justify-between mb-2">
                      <div className="text-3xl font-light text-base-content">{Math.max(0, acc.visits.limitToday - acc.visits.sentToday)}</div>
                      <div className="text-xs text-base-content/40 mb-1">left today</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-base-content/50 mb-1">
                      <span>{acc.visits.sentToday}</span>
                      <span>{acc.visits.limitToday}</span>
                    </div>
                    <div className="w-full bg-base-300/50 rounded-full h-1.5">
                      <div className="bg-[#0a66c2] h-1.5 rounded-full" style={{ width: `${Math.min(100, (acc.visits.sentToday / acc.visits.limitToday) * 100)}%` }}></div>
                    </div>
                  </div>

                  {/* FOLLOWS */}
                  <div className="bg-base-100 rounded-xl p-4 border border-base-300/50 opacity-60">
                    <div className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mb-4">Follows</div>
                    <div className="flex items-end justify-between mb-2">
                      <div className="text-3xl font-light text-base-content">100</div>
                      <div className="text-xs text-base-content/40 mb-1">left today</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-base-content/50 mb-1">
                      <span>0</span>
                      <span>100</span>
                    </div>
                    <div className="w-full bg-base-300/50 rounded-full h-1.5">
                      <div className="bg-base-300 h-1.5 rounded-full" style={{ width: '0%' }}></div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-base-300/40 text-[10px] text-center text-base-content/40">Coming Soon</div>
                  </div>
                </div>
              </div>
            ))}
            {data?.linkedin?.length === 0 && (
              <div className="bg-base-200 border border-base-300/50 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-base-300/30 rounded-full flex items-center justify-center mb-3">
                  <RiLinkedinBoxFill className="w-5 h-5 text-base-content/40" />
                </div>
                <h3 className="text-sm font-medium text-base-content">No LinkedIn accounts</h3>
                <p className="text-xs text-base-content/50 mt-1 max-w-sm">Connect a LinkedIn account to track daily limits and automated actions here.</p>
              </div>
            )}
          </div>
        </section>

        {/* EMAIL HEALTH */}
        <section className="pt-6 border-t border-base-300/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <RiMailSendLine size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Email Accounts</h2>
              <p className="text-xs text-base-content/60">Warmup tracking and daily SMTP limits.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data?.accounts.map((acc: any) => (
              <div key={acc.id} className="bg-base-200 rounded-xl border border-base-300/50 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-base-300/40 flex items-center justify-between bg-base-200/50">
                  <div>
                    <div className="font-medium text-sm text-base-content">{acc.name}</div>
                    <div className="text-xs text-base-content/50">{acc.from_email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-light text-base-content">{acc.sent_today} <span className="text-sm text-base-content/30">/ {acc.effective_limit_today}</span></div>
                    <div className="text-[10px] text-base-content/40 uppercase tracking-wider mt-0.5">Sent Today</div>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-end">
                  <div className="flex items-end justify-between gap-1.5 h-24 mb-4">
                    {acc.days.map((d: any, i: number) => {
                      const maxVal = Math.max(...acc.days.map((x: any) => x.limit), 10);
                      const h = Math.max(4, (d.sent / maxVal) * 100);
                      const limitH = Math.max(4, (d.limit / maxVal) * 100);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                          <div className="absolute w-full border-t border-base-content/10 border-dashed z-0" style={{ bottom: `${limitH}%` }}></div>
                          <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-base-300/90 backdrop-blur-md text-base-content text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 shadow-sm border border-base-content/5">
                            <div className="font-medium mb-0.5">{new Date(d.day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                            <div className="text-base-content/70">Sent: <span className="text-base-content font-medium">{d.sent}</span> / {d.limit}</div>
                          </div>
                          <div className={`w-full max-w-[24px] rounded-t-sm z-10 transition-all ${d.sent >= d.limit ? 'bg-warning/80 hover:bg-warning' : 'bg-orange-500/80 hover:bg-orange-500'}`} style={{ height: `${h}%` }}></div>
                          <div className="text-[9px] text-base-content/40 mt-2 truncate w-full text-center">
                            {new Date(d.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {acc.ramp_up_enabled === 1 ? (
                    <div className="text-[10px] text-base-content/50 flex items-center justify-between bg-base-300/30 px-3 py-2 rounded-lg">
                      <span>Warming up</span>
                      <span className="font-medium text-base-content/70">Day {Math.floor((new Date().getTime() - new Date(acc.ramp_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-base-content/30 text-center uppercase tracking-wider">Warmup disabled</div>
                  )}
                </div>
              </div>
            ))}
            {data?.accounts.length === 0 && (
              <div className="col-span-1 md:col-span-2 bg-base-200 border border-base-300/50 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-base-300/30 rounded-full flex items-center justify-center mb-3">
                  <RiMailSendLine className="w-5 h-5 text-base-content/40" />
                </div>
                <h3 className="text-sm font-medium text-base-content">No email accounts</h3>
                <p className="text-xs text-base-content/50 mt-1 max-w-sm">Connect an email account to view warmup health and daily sending limits.</p>
              </div>
            )}
          </div>
        </section>

        {/* GUARD TRIPS & LOGS */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-base-300/50">
          <div className="bg-base-200 rounded-xl border border-base-300/50 overflow-hidden flex flex-col h-96">
            <div className="px-5 py-3 border-b border-base-300/40 flex items-center gap-2">
              <RiShieldKeyholeLine className="text-warning" />
              <span className="text-sm font-medium text-base-content">Limit Guard Trips</span>
              <span className="ml-auto text-[10px] text-base-content/30 uppercase tracking-widest bg-base-300/50 px-2 py-0.5 rounded-full">Today</span>
            </div>
            <div className="divide-y divide-base-300/20 flex-1 overflow-y-auto">
              {data?.guardTrips.map((g: any, i: number) => {
                const acc = g.email_account_id ? data.accounts.find((a: any) => a.id === g.email_account_id) : (g.linkedin_account_id ? data.linkedin?.find((a: any) => a.id === g.linkedin_account_id) : null);
                return (
                  <div key={i} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-warning/80 font-medium">{g.message.replace("Daily limit reached — ", "→ ").replace("LinkedIn weekly quota", "→ Weekly LinkedIn limit")}</div>
                      {acc && <div className="text-[10px] text-base-content/40 mt-1">{acc.name}</div>}
                    </div>
                    <div className="text-[10px] text-base-content/30 whitespace-nowrap shrink-0 pt-0.5">{formatDateTime(g.created_at)}</div>
                  </div>
                );
              })}
              {data?.guardTrips.length === 0 && (
                <div className="px-5 py-8 flex flex-col items-center justify-center text-center h-full">
                  <RiShieldKeyholeLine className="w-8 h-8 text-success/20 mb-2" />
                  <div className="text-xs font-medium text-success/50">No guard trips today</div>
                  <div className="text-[10px] text-base-content/30 mt-1">All queues are operating within limits</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-base-200 rounded-xl border border-base-300/50 overflow-hidden flex flex-col h-96">
            <div className="px-5 py-3 border-b border-base-300/40 flex items-center gap-2">
              <RiTimeLine className="text-base-content/50" />
              <span className="text-sm font-medium text-base-content">Live Dispatch Log</span>
              <span className="ml-auto text-[10px] text-base-content/30 uppercase tracking-widest bg-base-300/50 px-2 py-0.5 rounded-full">Latest 50</span>
            </div>
            <div className="divide-y divide-base-300/20 flex-1 overflow-y-auto font-mono">
              {data?.recentLogs.map((l: any, i: number) => {
                const acc = l.email_account_id ? data.accounts.find((a: any) => a.id === l.email_account_id) : data.linkedin?.find((a: any) => a.id === l.linkedin_account_id);
                return (
                  <div key={i} className="px-5 py-2 flex items-start justify-between gap-4 hover:bg-base-300/20 transition-colors">
                    <div className="truncate min-w-0 flex-1">
                      <div className="text-[11px] text-base-content/80 truncate w-full">{l.message.replace("Email sent to ", "")}</div>
                      <div className="text-[9px] text-base-content/30 mt-0.5">{acc?.name ?? l.email_account_id?.slice(0, 8)}</div>
                    </div>
                    <div className="text-[9px] text-base-content/30 whitespace-nowrap shrink-0">{formatDateTime(l.created_at)}</div>
                  </div>
                );
              })}
              {data?.recentLogs.length === 0 && (
                <div className="px-5 py-8 text-xs text-base-content/30 text-center flex items-center justify-center h-full">No sends recorded</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
