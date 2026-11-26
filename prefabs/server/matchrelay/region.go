package matchrelay

import (
	"strings"
	"time"
)

// Continent codes; "??" is unknown (no header, Tor "T1", "XX", Antarctica).
var continents = map[string]string{
	"AF": "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW",
	"AS": "AE AF AM AZ BD BH BN BT CC CN CX GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TM TR TW UZ VN YE",
	"EU": "AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK",
	"NA": "AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI",
	"OC": "AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TL TO TV UM VU WF WS",
	"SA": "AR BO BR CL CO EC FK GF GY PE PY SR UY VE",
}

var countryContinent = func() map[string]string {
	m := map[string]string{}
	for cont, list := range continents {
		for _, cc := range strings.Fields(list) {
			m[cc] = cont
		}
	}
	return m
}()

// ContinentOf maps an ISO 3166-1 alpha-2 country (as sent in Cloudflare's
// CF-IPCountry) to AS, EU, NA, SA, OC, AF, or "??".
func ContinentOf(country string) string {
	if c, ok := countryContinent[strings.ToUpper(strings.TrimSpace(country))]; ok {
		return c
	}
	return "??"
}

// InputDelay is the lockstep input delay in frames for the larger of the two
// players' round-trip times: clamp(ceil(rtt / framePeriod) + 1, min, max),
// with the frame period rounded to 0.1 ms (16.7 ms at 60 fps), computed in
// integer microseconds so the boundaries are exact. A whole RTT, not half: an
// input goes player → relay → opponent, two one-way legs, which is about one
// round trip (2026-11-25: with rtt/2 every frame waited and a 60 fps match ran
// at about 47 fps through the relay).
func InputDelay(maxRTT time.Duration, frameRate, minDelay, maxDelay int) int {
	periodTenths := (20000/frameRate + 1) / 2 // 1/10 ms, rounded: 60 fps → 167
	periodMicros := int64(periodTenths * 100)
	us := maxRTT.Microseconds()
	d := 1
	if us > 0 {
		d = int((us+periodMicros-1)/periodMicros) + 1
	}
	return min(max(d, minDelay), maxDelay)
}
