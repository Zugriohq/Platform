using System;
using System.IO;
using System.Text.Json;
using Xunit;
using Zugrio.CBot.Engine;

namespace Zugrio.CBot.Core.Tests
{
    /// <summary>The EA runs decision-core under Jint. These tests prove Jint gives Node's answer.</summary>
    public class EngineTests
    {
        private static readonly Lazy<ZugrioEngine> Engine = new(ZugrioEngine.Load);
        private static string Fixture(string name) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", name));

        [Fact]
        public void Loads_and_passes_the_decision_core_self_test()
        {
            Assert.Matches("^[0-9a-f]{64}$", Engine.Value.BundleSha256);
        }

        [Fact]
        public void Scan_result_is_identical_to_the_node_reference()
        {
            var actual = JsonDocument.Parse(Engine.Value.ScanJson(Fixture("scan-request-gold-continuation.json"))).RootElement;
            var expected = JsonDocument.Parse(Fixture("scan-result-gold-continuation.json")).RootElement;
            Assert.Equal(expected.GetRawText(), actual.GetRawText());
            var g = actual.GetProperty("best").GetProperty("geometry");
            Assert.Equal(111, g.GetProperty("entryReference").GetDouble());
            Assert.Equal(105, g.GetProperty("childInvalidation").GetDouble());
            Assert.Equal(130, g.GetProperty("objective").GetDouble());
        }

        [Fact]
        public void Bad_requests_fail_closed()
        {
            Assert.ThrowsAny<Exception>(() => Engine.Value.ScanJson("{\"schema\":\"other\"}"));
        }
    }
}
