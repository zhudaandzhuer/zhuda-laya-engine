package dungeongateway_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	authority "zhudagamecenter/commonprefabs/server/dungeonauthority"
	gateway "zhudagamecenter/commonprefabs/server/dungeongateway"
)

func TestHealthAndRoundRoutes(t *testing.T) {
	handler := gateway.New(authority.NewService()).Handler()
	health := httptest.NewRecorder()
	handler.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/api/health", nil))
	if health.Code != http.StatusOK || !strings.Contains(health.Body.String(), `"status":"ok"`) {
		t.Fatalf("health: %d %s", health.Code, health.Body.String())
	}
	request := httptest.NewRequest(http.MethodPost, "/api/round", strings.NewReader(`{"playerId":"p1","fixture":"three","singleBet":10}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"pointsAfter":100010`) {
		t.Fatalf("round: %d %s", response.Code, response.Body.String())
	}
}
