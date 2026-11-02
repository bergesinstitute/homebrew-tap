class Berges < Formula
  desc "Berges AI as an agent in your terminal, powered by goose"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.1.0.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  head "https://github.com/bergesinstitute/homebrew-tap.git", branch: "master"

  depends_on "block-goose-cli"
  depends_on "jq"

  def install
    bin.install "berges/bin/berges"
    pkgshare.install "berges/sprites"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/berges --version")
  end
end
