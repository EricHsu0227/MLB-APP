"""
Build one season of team-sheet data:
  official counting stats + L/R splits  -> MLB Stats API
  plate discipline, batted ball, pitch type/velocity/values -> Statcast pitch-by-pitch CSVs (fetch_statcast.py)
  wOBA linear weights, wOBA scale, park factors, FIP constant -> derived from that season's own data

usage: python build_data.py 2026 raw/2026 data/2026.json
"""
import sys, os, json, glob, math, time, urllib.request
import numpy as np, pandas as pd

SEASON, RAW, OUT = int(sys.argv[1]), sys.argv[2], sys.argv[3]
API = "https://statsapi.mlb.com/api/v1"

def get(url, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "team-sheet builder"})
            return json.loads(urllib.request.urlopen(req, timeout=60).read())
        except Exception as e:
            if k == tries - 1: raise
            time.sleep(2 * (k + 1))

# ---------------------------------------------------------------- official data
teams = [t for t in get(f"{API}/teams?sportId=1&season={SEASON}")["teams"]]
TEAM = {t["id"]: dict(id=t["id"], name=t["name"], abbr=t["abbreviation"], league=t.get("league", {}).get("name", ""),
                      lg=("AL" if t.get("league", {}).get("id") == 103 else "NL"), division=t.get("division", {}).get("name", ""))
        for t in teams}
ABBR2ID = {v["abbr"]: k for k, v in TEAM.items()}
_ath = ABBR2ID.get("ATH", ABBR2ID.get("OAK"))  # Savant labels the A's "ATH" for every season; the MLB API says "OAK" before 2025
ABBR2ID.update({"ARI": ABBR2ID.get("AZ"), "OAK": _ath, "ATH": _ath})

HIT_F = ["G","PA","AB","R","H","2B","3B","HR","RBI","BB","IBB","SO","HBP","SF","SH","SB","CS","GIDP","TB"]
HIT_MAP = dict(G="gamesPlayed",PA="plateAppearances",AB="atBats",R="runs",H="hits",**{"2B":"doubles","3B":"triples"},HR="homeRuns",
               RBI="rbi",BB="baseOnBalls",IBB="intentionalWalks",SO="strikeOuts",HBP="hitByPitch",SF="sacFlies",SH="sacBunts",
               SB="stolenBases",CS="caughtStealing",GIDP="groundIntoDoublePlay",TB="totalBases")
PIT_F = ["G","GS","W","L","SV","HLD","BS","CG","SHO","GF","OUTS","BF","AB","H","R","ER","2B","3B","HR","BB","IBB","SO","HBP","WP","BK","SF","SH","TB"]
PIT_MAP = dict(G="gamesPitched",GS="gamesStarted",W="wins",L="losses",SV="saves",HLD="holds",BS="blownSaves",CG="completeGames",
               SHO="shutouts",GF="gamesFinished",OUTS="outs",BF="battersFaced",AB="atBats",H="hits",R="runs",ER="earnedRuns",
               **{"2B":"doubles","3B":"triples"},HR="homeRuns",BB="baseOnBalls",IBB="intentionalWalks",SO="strikeOuts",HBP="hitBatsmen",
               WP="wildPitches",BK="balks",SF="sacFlies",SH="sacBunts",TB="totalBases")

def conv(stat, group):
    m = HIT_MAP if group == "hitting" else PIT_MAP
    out = {}
    for k, src in m.items():
        v = stat.get(src)
        if k == "OUTS" and v is None: v = stat.get("outsPitched")
        if k == "G" and v is None: v = stat.get("gamesPlayed")
        if k == "HBP" and group == "pitching" and v is None: v = stat.get("hitByPitch")
        out[k] = None if v is None else int(v)
    return out

rows = {"hitting": {}, "pitching": {}}   # (teamId, playerId) -> {"age":..,"tot":{},"vl":{},"vr":{}}
people_ids = set()
for tid in TEAM:
    for group in ("hitting", "pitching"):
        base = f"{API}/stats?group={group}&season={SEASON}&teamId={tid}&playerPool=ALL&limit=1000"
        for sp in get(base + "&stats=season")["stats"][0]["splits"]:
            r = rows[group].setdefault((tid, sp["player"]["id"]), {})
            r["tot"] = conv(sp["stat"], group); r["age"] = sp["stat"].get("age"); people_ids.add(sp["player"]["id"])
        st = get(base + "&stats=statSplits&sitCodes=vl,vr")["stats"]
        for sp in (st[0]["splits"] if st else []):
            code = sp["split"]["code"]
            r = rows[group].setdefault((tid, sp["player"]["id"]), {})
            r[code] = conv(sp["stat"], group); people_ids.add(sp["player"]["id"])
    print("api team", TEAM[tid]["abbr"], flush=True)

jersey = {}
for tid in TEAM:
    for r in get(f"{API}/teams/{tid}/roster?rosterType=fullSeason&season={SEASON}").get("roster", []):
        jersey[(tid, r["person"]["id"])] = r.get("jerseyNumber", "")

PEOPLE = {}
ids = sorted(people_ids)
for i in range(0, len(ids), 150):
    for p in get(f"{API}/people?personIds={','.join(map(str, ids[i:i+150]))}")["people"]:
        place = ", ".join(x for x in (p.get("birthCity"), p.get("birthStateProvince") or p.get("birthCountry")) if x)
        PEOPLE[p["id"]] = dict(name=p["fullName"], last=p.get("lastName", p["fullName"]), bats=p.get("batSide", {}).get("code", ""),
                               throws=p.get("pitchHand", {}).get("code", ""), pos=p.get("primaryPosition", {}).get("abbreviation", ""),
                               ht=(p.get("height") or "").replace(" ", ""), wt=p.get("weight") or "", born=p.get("birthDate") or "",
                               place=place, debut=p.get("mlbDebutDate") or "")

# league totals + park factors (home/away runs scored + allowed)
lg = {"hitting": {}, "pitching": {}}
for group in ("hitting", "pitching"):
    for sp in get(f"{API}/teams/stats?stats=season&group={group}&season={SEASON}&sportIds=1")["stats"][0]["splits"]:
        lg[group][sp["team"]["id"]] = conv(sp["stat"], group)
pf_raw = {}
for tid in TEAM:
    ha = {}
    for group in ("hitting", "pitching"):
        for sp in get(f"{API}/teams/{tid}/stats?stats=statSplits&sitCodes=h,a&group={group}&season={SEASON}")["stats"][0]["splits"]:
            d = ha.setdefault(sp["split"]["code"], {"R": 0, "G": 0})
            d["R"] += int(sp["stat"].get("runs") or 0)
            if group == "hitting": d["G"] = int(sp["stat"]["gamesPlayed"])
    try: pf_raw[tid] = (ha["h"]["R"] / ha["h"]["G"]) / (ha["a"]["R"] / ha["a"]["G"])
    except Exception: pf_raw[tid] = 1.0
# FanGraphs-style "basic" park factor: half the games are at home; regress the one-season value halfway to 1.00
PF = {tid: round(1 + (v - 1) / 2 * 0.5, 3) for tid, v in pf_raw.items()}

def tot(d, keys):
    return {k: sum((v.get(k) or 0) for v in d.values()) for k in keys}
LH = tot(lg["hitting"], HIT_F)
LP = tot(lg["pitching"], PIT_F)
LH_by = {l: tot({t: v for t, v in lg["hitting"].items() if TEAM[t]["lg"] == l}, HIT_F) for l in ("AL", "NL")}

# ---------------------------------------------------------------- statcast
COLS = ["pitch_type","game_date","release_speed","batter","pitcher","events","description","zone","stand","p_throws",
        "home_team","away_team","bb_type","balls","strikes","on_3b","on_2b","on_1b","outs_when_up","inning","inning_topbot",
        "hc_x","hc_y","game_pk","at_bat_number","pitch_number","bat_score","post_bat_score","delta_run_exp","game_type",
        "woba_value","woba_denom","estimated_woba_using_speedangle"]
files = sorted(glob.glob(f"{RAW}/*.csv"))
df = pd.concat([pd.read_csv(f, usecols=lambda c: c in COLS, low_memory=False) for f in files], ignore_index=True)
df = df[df.game_type == "R"].drop_duplicates(["game_pk", "at_bat_number", "pitch_number"])
print("pitches", len(df), flush=True)
top = df.inning_topbot == "Top"
df["bat_abbr"] = np.where(top, df.away_team, df.home_team)
df["fld_abbr"] = np.where(top, df.home_team, df.away_team)
df["bat_tid"] = df.bat_abbr.map(ABBR2ID); df["fld_tid"] = df.fld_abbr.map(ABBR2ID)
missing = set(df.bat_abbr[df.bat_tid.isna()])
if missing: print("WARNING unmapped team abbreviations", missing)

# ---- RE24 linear weights (FanGraphs/Tango method, from this season's own play-by-play)
NON_PA = ("caught_stealing", "pickoff", "stolen_base", "wild_pitch", "passed_ball", "other_advance", "game_advisory",
          "truncated_pa", "other_out", "runner_double_play", "ejection")
pa = df[df.events.notna() & ~df.events.astype(str).str.startswith(NON_PA)].copy()
pa = pa.sort_values(["game_pk", "inning", "inning_topbot", "at_bat_number"])
pa["state"] = (pa.outs_when_up.astype(int) * 8 + pa.on_1b.notna() * 1 + pa.on_2b.notna() * 2 + pa.on_3b.notna() * 4)
half = ["game_pk", "inning", "inning_topbot"]
pa["half_end"] = pa.groupby(half).post_bat_score.transform("max")
pa["roi"] = pa.half_end - pa.bat_score
reg = pa[pa.inning <= 8]
RE = reg.groupby("state").roi.mean().to_dict()
pa["re"] = pa.state.map(RE)
pa["re_next"] = pa.groupby(half).re.shift(-1).fillna(0.0)
pa["rv"] = pa.re_next - pa.re + (pa.post_bat_score - pa.bat_score)
ev = pa.events
cls = pd.Series("other", index=pa.index)
cls[ev == "walk"] = "uBB"; cls[ev == "hit_by_pitch"] = "HBP"; cls[ev == "single"] = "1B"; cls[ev == "double"] = "2B"
cls[ev == "triple"] = "3B"; cls[ev == "home_run"] = "HR"
cls[ev.isin(["field_out","strikeout","force_out","grounded_into_double_play","double_play","fielders_choice_out",
             "strikeout_double_play","triple_play","sac_fly","sac_fly_double_play","sac_bunt","sac_bunt_double_play"])] = "OUT"
rvm = pa.groupby(cls).rv.mean()
raw_w = {k: float(rvm[k] - rvm["OUT"]) for k in ["uBB", "HBP", "1B", "2B", "3B", "HR"]}
# Eric's Value/Expected penalties: runs a strikeout / GIDP costs beyond an ordinary out
reg_out = ev.isin(["field_out", "force_out", "fielders_choice_out"])
rv_reg = pa.rv[reg_out].mean()
KPEN = float(rv_reg - pa.rv[ev.isin(["strikeout", "strikeout_double_play"])].mean())
GDPPEN = float(rv_reg - pa.rv[ev.isin(["grounded_into_double_play", "double_play"])].mean())
print("kPen", round(KPEN, 4), "gdpPen", round(GDPPEN, 4))
s1b = LH["H"] - LH["2B"] - LH["3B"] - LH["HR"]
num = (raw_w["uBB"] * (LH["BB"] - LH["IBB"]) + raw_w["HBP"] * LH["HBP"] + raw_w["1B"] * s1b + raw_w["2B"] * LH["2B"]
       + raw_w["3B"] * LH["3B"] + raw_w["HR"] * LH["HR"])
den = LH["AB"] + LH["BB"] - LH["IBB"] + LH["SF"] + LH["HBP"]
lgOBP = (LH["H"] + LH["BB"] + LH["HBP"]) / (LH["AB"] + LH["BB"] + LH["HBP"] + LH["SF"])
scale = lgOBP / (num / den)
W = {k: round(v * scale, 3) for k, v in raw_w.items()}
lgwOBA = sum(W[k] * n for k, n in [("uBB", LH["BB"] - LH["IBB"]), ("HBP", LH["HBP"]), ("1B", s1b), ("2B", LH["2B"]),
                                   ("3B", LH["3B"]), ("HR", LH["HR"])]) / den
print("weights", W, "scale", round(scale, 3), "lgwOBA", round(lgwOBA, 3))

# ---- pitch-level flags
desc = df.description.astype(str)
SWING = desc.isin(["swinging_strike","swinging_strike_blocked","foul","foul_tip","foul_bunt","missed_bunt","hit_into_play","bunt_foul_tip","foul_pitchout","swinging_pitchout"])
WHIFF = desc.isin(["swinging_strike","swinging_strike_blocked","missed_bunt","swinging_pitchout"])
CONTACT = SWING & ~WHIFF
CALLED = desc.eq("called_strike")
z = pd.to_numeric(df.zone, errors="coerce")
INZ = z.between(1, 9); OUTZ = z.between(11, 14)
first = (df.balls == 0) & (df.strikes == 0) & ~desc.isin(["automatic_ball", "pitchout"]) & df.pitch_type.ne("PO")
STRIKE_FIRST = first & (SWING | CALLED | desc.eq("automatic_strike"))
bb = df.bb_type.astype(str)
inplay = desc.eq("hit_into_play")
# spray angle: + toward right field
ang = np.degrees(np.arctan2(df.hc_x - 125.42, 198.27 - df.hc_y))
spray_ok = inplay & df.hc_x.notna()
pull = np.where(df.stand == "R", ang < -15, ang > 15)
oppo = np.where(df.stand == "R", ang > 15, ang < -15)
PT = {"FF":"FA","FA":"FA","SI":"SI","FC":"FC","SL":"SL","ST":"ST","SV":"CU","CU":"CU","KC":"CU","CS":"CU",
      "CH":"CH","FS":"FS","FO":"FS","SC":"FS","KN":"KN","EP":"XX","UN":"XX"}
PTYPES = ["FA","SI","FC","SL","ST","CU","CH","FS","KN"]
ptg = df.pitch_type.map(PT)
pitch_ok = df.pitch_type.notna() & df.pitch_type.ne("PO") & ~desc.isin(["pitchout", "automatic_ball", "automatic_strike"])

feat = pd.DataFrame({
    "NP": pitch_ok, "ZONE": pitch_ok & INZ, "OZONE": pitch_ok & OUTZ,
    "ZSW": SWING & INZ, "OSW": SWING & OUTZ, "ZCT": CONTACT & INZ, "OCT": CONTACT & OUTZ,
    "SW": SWING, "CT": CONTACT, "WHF": WHIFF, "CSTR": CALLED,
    "FPA": first, "FST": STRIKE_FIRST,
    "GB": inplay & bb.eq("ground_ball"), "LD": inplay & bb.eq("line_drive"), "FB": inplay & bb.eq("fly_ball"), "PU": inplay & bb.eq("popup"),
    "SPR": spray_ok, "PULL": spray_ok & pull, "OPPO": spray_ok & oppo,
}).astype(np.int32)
feat["CENT"] = feat.SPR - feat.PULL - feat.OPPO
# xwOBA (for Expected+): estimated value on batted balls, actual wOBA value otherwise, on PA-ending pitches
is_pa_end = df.events.notna() & ~df.events.astype(str).str.startswith(NON_PA)
wden = pd.to_numeric(df.woba_denom, errors="coerce").fillna(0)
xval = pd.to_numeric(df.estimated_woba_using_speedangle, errors="coerce").where(lambda v: v.notna(), pd.to_numeric(df.woba_value, errors="coerce")).fillna(0)
feat["XWD"] = np.where(is_pa_end, wden, 0).astype(np.int32)
feat["XWN"] = np.where(is_pa_end & (wden > 0), xval, 0.0)
rv = pd.to_numeric(df.delta_run_exp, errors="coerce").fillna(0.0)
velo = pd.to_numeric(df.release_speed, errors="coerce")
for p in PTYPES:
    m = (ptg == p) & pitch_ok
    feat[f"n{p}"] = m.astype(np.int32)
    feat[f"vs{p}"] = np.where(m & velo.notna(), velo, 0.0)
    feat[f"vn{p}"] = (m & velo.notna()).astype(np.int32)
    feat[f"rv{p}"] = np.where(m, rv, 0.0)
SC_F = list(feat.columns)

def agg(tcol, pcol, hand_col, sign):
    f = feat.copy()
    for p in PTYPES: f[f"rv{p}"] = f[f"rv{p}"] * sign
    f["tid"] = df[tcol]; f["pid"] = df[pcol]; f["hand"] = df[hand_col]
    f = f[f.tid.notna()]
    tot_ = f.groupby(["tid", "pid"])[SC_F].sum()
    byh = f.groupby(["tid", "pid", "hand"])[SC_F].sum()
    return tot_, byh

SC = {"hitting": agg("bat_tid", "batter", "p_throws", 1), "pitching": agg("fld_tid", "pitcher", "stand", -1)}

# league batted-ball constants (for xFIP)
lgFBall = int(feat.FB.sum() + feat.PU.sum())
lgHRFB = LP["HR"] / lgFBall if lgFBall else 0.11
lgIP = LP["OUTS"] / 3
lgERA = LP["ER"] * 9 / lgIP
FIPC = lgERA - (13 * LP["HR"] + 3 * (LP["BB"] + LP["HBP"]) - 2 * LP["SO"]) / lgIP
lgRPA = LH["R"] / LH["PA"]
lgRA9 = LP["R"] * 9 / lgIP
runsPerOut = LH["R"] / LP["OUTS"]
lgwSB = (LH["SB"] * 0.2 - LH["CS"] * (2 * runsPerOut + 0.075)) / (s1b + LH["BB"] + LH["HBP"] - LH["IBB"])
# SIERA-style league inputs
consts = dict(season=SEASON, w=W, scale=round(scale, 4), lgwOBA=round(lgwOBA, 4), lgOBP=round(lgOBP, 4), lgRPA=round(lgRPA, 5),
              lgRPA_by={l: round(v["R"] / v["PA"], 5) for l, v in LH_by.items()},
              lgERA=round(lgERA, 3), lgRA9=round(lgRA9, 3), FIPC=round(FIPC, 3), lgHRFB=round(lgHRFB, 4), runsPerOut=round(runsPerOut, 5),
              lgwSB=round(lgwSB, 5), lgFIP_like=None,
              kPen=round(KPEN, 4), gdpPen=round(GDPPEN, 4), lgKrate=round(LH["SO"] / LH["PA"], 5), lgGDPrate=round(LH["GIDP"] / LH["PA"], 5),
              rW=round(9 * (LP["R"] / lgIP) * 1.5 + 3, 3), raPerEra=round(lgRA9 / lgERA, 4), PF={str(k): v for k, v in PF.items()}, RE=RE)

# ---------------------------------------------------------------- assemble
def pack(d, fields):
    return [None if d is None or d.get(k) is None else d.get(k) for k in fields]

def sc_vec(series):
    out = []
    for k in SC_F:
        v = series[k]
        if k.startswith("rv") or k.startswith("vs") or k == "XWN": out.append(round(float(v), 2))
        else: out.append(int(v))
    return out

data = {"season": SEASON, "built": time.strftime("%Y-%m-%d"), "teams": list(TEAM.values()), "consts": consts,
        "fields": {"hitting": HIT_F, "pitching": PIT_F, "sc": SC_F}, "people": {}, "rows": {"hitting": [], "pitching": []}}
for group in ("hitting", "pitching"):
    sc_tot, sc_h = SC[group]
    for (tid, pid), r in rows[group].items():
        p = PEOPLE.get(pid)
        if p: data["people"][str(pid)] = [p["name"], p["last"], p["bats"], p["throws"], p["pos"], p["ht"], p["wt"], p["born"], p["place"], p["debut"]]
        rec = {"t": tid, "p": pid, "age": r.get("age"), "num": jersey.get((tid, pid), "")}
        for code in ("tot", "vl", "vr"):
            rec[code] = pack(r.get(code), HIT_F if group == "hitting" else PIT_F) if r.get(code) else None
        key = (float(tid), pid)
        rec["sc_tot"] = sc_vec(sc_tot.loc[key]) if key in sc_tot.index else None
        for code, hand in (("vl", "L"), ("vr", "R")):
            k3 = (float(tid), pid, hand)
            rec["sc_" + code] = sc_vec(sc_h.loc[k3]) if k3 in sc_h.index else None
        data["rows"][group].append(rec)
# active (26-man) roster stints, from daily snapshots (fetch_rosters.py)
act_file = os.path.join(RAW, "active.json")
if os.path.exists(act_file):
    import datetime as dt
    A = json.load(open(act_file)); d0 = dt.date.fromisoformat(A["start"])
    ndays = (dt.date.fromisoformat(A["end"]) - d0).days + 1
    stints = {}
    for tid, byday in A["days"].items():
        on = {}
        for d, ids in byday.items():
            i = (dt.date.fromisoformat(d) - d0).days
            for pid in ids: on.setdefault(pid, set()).add(i)
        for pid, idx in on.items():
            idx = sorted(idx); runs = [[idx[0], idx[0]]]
            for i in idx[1:]:
                if i == runs[-1][1] + 1: runs[-1][1] = i
                else: runs.append([i, i])
            stints[f"{tid}-{pid}"] = runs
    data["active"] = {"start": A["start"], "end": A["end"], "n": ndays, "s": stints}
    print("active-roster stints for", len(stints), "team-players")
# Eric's RRAA / wwOBA / wwRC+ / RWAR, as published by his MLB-APP (season totals per player, all / vsL / vsR).
# Counting values are shared between teams by PA (TBF for pitchers); rates are stored PA-weighted so totals add up.
def load_mlbapp(role):
    src = os.environ.get("MLBAPP_DATA") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "data")  # local folder with <season>/bat.json, or default to GitHub
    try:
        if src and os.path.exists(os.path.join(src, str(SEASON), f"{role}.json")):
            return json.load(open(os.path.join(src, str(SEASON), f"{role}.json")))["players"]
        return get(f"https://raw.githubusercontent.com/EricHsu0227/MLB-APP/main/public/data/{SEASON}/{role}.json")["players"]
    except Exception as e:
        print(f"[warn] no MLB-APP {role} data for {SEASON}: {e}"); return []
RR_COUNT = {"bat": ["RRAA", "RRAA_Bat", "RRAA_BsR", "RRAA_Fld", "RWAR"], "pit": ["RRAA", "RWAR"]}
RR_RATE = {"bat": ["wwOBA", "wwRC+"], "pit": ["wwOBA", "wwRC+"]}
n_rr = 0
for group, role in (("hitting", "bat"), ("pitching", "pit")):
    app = {x["id"]: x.get("splits", {}) for x in load_mlbapp(role)}
    F = HIT_F if group == "hitting" else PIT_F; qk = "PA" if group == "hitting" else "BF"
    # season totals of the qualifier across all teams (MLB-APP values are season totals)
    season_q = {}
    for rec in data["rows"][group]:
        for code in ("tot", "vl", "vr"):
            if rec[code]: season_q[(rec["p"], code)] = season_q.get((rec["p"], code), 0) + (rec[code][F.index(qk)] or 0)
    for rec in data["rows"][group]:
        sp = app.get(rec["p"])
        if not sp: continue
        for code, key in (("tot", "all"), ("vl", "vsL"), ("vr", "vsR")):
            x = sp.get(key)
            if not x or "RRAA" not in x or not rec[code]: continue
            q = rec[code][F.index(qk)] or 0; tot_q = season_q.get((rec["p"], code)) or 0
            share = q / tot_q if tot_q else 0
            o = {"RR_PA": q}
            for k in RR_COUNT[role]:
                if x.get(k) is not None: o["RR_" + k] = round(x[k] * share, 3)
            for k in RR_RATE[role]:
                if x.get(k) is not None: o["RR_" + k + "_n"] = round(x[k] * q, 3)
            rec["rr_" + code] = o; n_rr += 1
print("RRAA rows attached:", n_rr)
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
json.dump(data, open(OUT, "w"), separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB;", {g: len(v) for g, v in data["rows"].items()})
