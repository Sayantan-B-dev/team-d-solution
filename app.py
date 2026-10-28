import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
CORS(app)
BASE = os.path.dirname(os.path.abspath(__file__))


@app.get("/")
def index():
    return send_from_directory(BASE, "index.html")


@app.get("/health")
def health():
    return jsonify(status="ok", project="Team D: Link Shortener + Analytics", stack="flask")

@app.route("/api/shorten", methods=["POST"])
def ep_0(**kwargs):
    # TODO: Body: {url, alias?} -> {code}
    return jsonify(error="Not implemented", todo="Body: {url, alias?} -> {code}"), 501

@app.route("/r/<code>", methods=["GET"])
def ep_1(**kwargs):
    # TODO: Redirect to the original URL
    return jsonify(error="Not implemented", todo="Redirect to the original URL"), 501

@app.route("/api/stats/<code>", methods=["GET"])
def ep_2(**kwargs):
    # TODO: Click analytics for a link
    return jsonify(error="Not implemented", todo="Click analytics for a link"), 501


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
